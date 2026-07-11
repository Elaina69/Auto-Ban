import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { configManager } from '../utils/configManager.js';
import { createContentFingerprint } from './_spamDetector.js';

export const DEFAULT_RAID_SETTINGS = Object.freeze({
    enabled: false,
    mode: 'alert',
    joinThreshold: 10,
    joinWindowMs: 60_000,
    incidentDurationMs: 10 * 60_000,
    campaignWindowMs: 60_000,
    campaignMinAccounts: 3,
    campaignMinChannels: 3,
    newAccountAgeMs: 7 * 24 * 60 * 60 * 1000,
    quarantineRoleId: null,
    protectedRoleId: null,
    notifyChannelId: null,
    releaseAfterScreening: false,
    incidentRetentionDays: 30
});

function asInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
}

function getRaidSettings(guildId) {
    const settings = configManager.loadServerConfig()[guildId]?.raidProtection || {};
    return {
        ...DEFAULT_RAID_SETTINGS,
        ...settings,
        joinThreshold: asInteger(settings.joinThreshold, DEFAULT_RAID_SETTINGS.joinThreshold, 3, 100),
        joinWindowMs: asInteger(settings.joinWindowMs, DEFAULT_RAID_SETTINGS.joinWindowMs, 10_000, 10 * 60_000),
        incidentDurationMs: asInteger(settings.incidentDurationMs, DEFAULT_RAID_SETTINGS.incidentDurationMs, 60_000, 60 * 60_000),
        campaignWindowMs: asInteger(settings.campaignWindowMs, DEFAULT_RAID_SETTINGS.campaignWindowMs, 10_000, 10 * 60_000),
        campaignMinAccounts: asInteger(settings.campaignMinAccounts, DEFAULT_RAID_SETTINGS.campaignMinAccounts, 2, 20),
        campaignMinChannels: asInteger(settings.campaignMinChannels, DEFAULT_RAID_SETTINGS.campaignMinChannels, 2, 20),
        newAccountAgeMs: asInteger(settings.newAccountAgeMs, DEFAULT_RAID_SETTINGS.newAccountAgeMs, 0, 365 * 24 * 60 * 60 * 1000),
        incidentRetentionDays: asInteger(settings.incidentRetentionDays, DEFAULT_RAID_SETTINGS.incidentRetentionDays, 1, 90)
    };
}

function incidentId(guildId) {
    return `raid_${Date.now().toString(36)}_${guildId.slice(-6)}`;
}

class RaidDetector {
    constructor() {
        this.joinWindows = new Map();
        this.activeIncidents = new Map();
        this.joinCleanupTimers = new Map();
        this.incidentTimers = new Map();
        this.campaignTimers = new Map();
    }

    getSettings(guildId) {
        return getRaidSettings(guildId);
    }

    getActiveIncident(guildId, now = Date.now()) {
        const incident = this.activeIncidents.get(guildId);
        if (!incident || incident.expiring) return null;

        if (now - incident.lastActivityAt > incident.settings.incidentDurationMs) {
            this.expireIncident(guildId, now).catch(error => {
                console.warn(`[RAID] Could not expire incident ${incident.id}: ${error.message}`);
            });
            return null;
        }

        return incident;
    }

    serializeIncident(incident) {
        const expiresAt = new Date(
            incident.startedAt + incident.settings.incidentRetentionDays * 24 * 60 * 60 * 1000
        ).toISOString();

        return {
            incidentId: incident.id,
            guildId: incident.guildId,
            startedAt: new Date(incident.startedAt).toISOString(),
            endedAt: incident.endedAt ? new Date(incident.endedAt).toISOString() : null,
            status: incident.status,
            reason: incident.reason,
            joinCount: incident.memberIds.size,
            newAccountCount: incident.newAccountCount,
            messageCampaigns: incident.messageCampaigns,
            affectedUserIds: [...incident.memberIds],
            actions: { ...incident.actions },
            expiresAt
        };
    }

    persistIncident(incident) {
        const record = this.serializeIncident(incident);
        configManager.updateRaidIncidents(allIncidents => {
            if (!Array.isArray(allIncidents[incident.guildId])) {
                allIncidents[incident.guildId] = [];
            }

            const index = allIncidents[incident.guildId]
                .findIndex(item => item.incidentId === incident.id);
            if (index >= 0) allIncidents[incident.guildId][index] = record;
            else allIncidents[incident.guildId].push(record);
        });
    }

    async notify(guild, settings, title, description, fields = []) {
        const channelId = settings.notifyChannelId ||
            configManager.loadServerConfig()[guild.id]?.notifyChannelId;
        if (!channelId) return false;

        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased?.()) return false;
        if (!channel.viewable || !channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) return false;

        const embed = new EmbedBuilder()
            .setColor(0xff6b00)
            .setTitle(title)
            .setDescription(description)
            .setTimestamp();
        if (fields.length > 0) embed.addFields(fields);
        return channel.send({ embeds: [embed] }).then(() => true).catch(error => {
            console.warn(`[RAID] Could not notify guild ${guild.id}: ${error.message}`);
            return false;
        });
    }

    scheduleJoinCleanup(guildId, windowMs) {
        const existing = this.joinCleanupTimers.get(guildId);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
            const now = Date.now();
            const recent = (this.joinWindows.get(guildId) || [])
                .filter(entry => now - entry.joinedAt <= windowMs);
            if (recent.length > 0) {
                this.joinWindows.set(guildId, recent);
                this.scheduleJoinCleanup(guildId, windowMs);
            } else {
                this.joinWindows.delete(guildId);
                this.joinCleanupTimers.delete(guildId);
            }
        }, windowMs + 50);
        timer.unref?.();
        this.joinCleanupTimers.set(guildId, timer);
    }

    scheduleIncidentExpiry(guildId, durationMs) {
        const existing = this.incidentTimers.get(guildId);
        if (existing) clearTimeout(existing);
        const timer = setTimeout(() => {
            this.expireIncident(guildId).catch(error => {
                console.warn(`[RAID] Could not expire guild ${guildId} incident: ${error.message}`);
            });
        }, durationMs + 50);
        timer.unref?.();
        this.incidentTimers.set(guildId, timer);
    }

    scheduleCampaignCleanup(incident, fingerprint) {
        const key = `${incident.guildId}:${fingerprint}`;
        const existing = this.campaignTimers.get(key);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
            const now = Date.now();
            const recent = (incident.campaigns.get(fingerprint) || [])
                .filter(entry => now - entry.timestamp <= incident.settings.campaignWindowMs);
            if (recent.length > 0) {
                incident.campaigns.set(fingerprint, recent);
                this.scheduleCampaignCleanup(incident, fingerprint);
            } else {
                incident.campaigns.delete(fingerprint);
                incident.detectedFingerprints.delete(fingerprint);
                this.campaignTimers.delete(key);
            }
        }, incident.settings.campaignWindowMs + 50);
        timer.unref?.();
        this.campaignTimers.set(key, timer);
    }

    async applyQuarantine(member, settings, incident) {
        if (!settings.quarantineRoleId || member.user.bot) return false;
        const role = member.guild.roles.cache.get(settings.quarantineRoleId);
        const me = member.guild.members.me;
        if (!role || !me?.permissions.has(PermissionFlagsBits.ManageRoles)) return false;
        if (role.position >= me.roles.highest.position || member.roles.cache.has(role.id)) return false;

        try {
            await member.roles.add(role, `Auto-Ban raid protection: ${incident.id}`);
            incident.quarantinedIds.add(member.id);
            incident.actions.quarantined++;
            return true;
        } catch (error) {
            console.warn(`[RAID] Could not quarantine member ${member.id}: ${error.message}`);
            return false;
        }
    }

    async removeQuarantine(member, settings, incident) {
        if (!settings.quarantineRoleId || !member.roles.cache.has(settings.quarantineRoleId)) return false;
        try {
            await member.roles.remove(settings.quarantineRoleId, `Auto-Ban screening completed: ${incident.id}`);
            incident.quarantinedIds.delete(member.id);
            incident.actions.released++;
            return true;
        } catch (error) {
            console.warn(`[RAID] Could not release member ${member.id}: ${error.message}`);
            return false;
        }
    }

    async handleMemberAdd(member) {
        if (member.user.bot) return;
        const settings = getRaidSettings(member.guild.id);
        if (!settings.enabled || settings.mode === 'off') return;

        const now = Date.now();
        const recent = (this.joinWindows.get(member.guild.id) || [])
            .filter(entry =>
                now - entry.joinedAt <= settings.joinWindowMs &&
                entry.userId !== member.id
            );
        recent.push({
            userId: member.id,
            joinedAt: now,
            accountAgeMs: now - member.user.createdTimestamp
        });
        this.joinWindows.set(member.guild.id, recent);
        this.scheduleJoinCleanup(member.guild.id, settings.joinWindowMs);

        let incident = this.getActiveIncident(member.guild.id, now);
        if (!incident && recent.length >= settings.joinThreshold) {
            incident = {
                id: incidentId(member.guild.id),
                guildId: member.guild.id,
                guild: member.guild,
                startedAt: now,
                lastActivityAt: now,
                endedAt: null,
                status: 'active',
                expiring: false,
                reason: 'join_burst',
                settings,
                memberIds: new Set(recent.map(entry => entry.userId)),
                quarantinedIds: new Set(),
                campaigns: new Map(),
                detectedFingerprints: new Set(),
                messageCampaigns: 0,
                newAccountCount: recent.filter(entry => entry.accountAgeMs <= settings.newAccountAgeMs).length,
                actions: { quarantined: 0, released: 0, rolesRemoved: 0, membersLeft: 0, enforced: 0 }
            };
            this.activeIncidents.set(member.guild.id, incident);
            this.scheduleIncidentExpiry(member.guild.id, settings.incidentDurationMs);
            this.persistIncident(incident);

            await this.notify(
                member.guild,
                settings,
                'Join raid detected',
                `Detected ${recent.length} member joins inside ${Math.round(settings.joinWindowMs / 1000)} seconds.`,
                [
                    { name: 'Incident', value: incident.id, inline: true },
                    { name: 'Mode', value: settings.mode, inline: true },
                    { name: 'New accounts', value: String(incident.newAccountCount), inline: true }
                ]
            );

            if (settings.mode === 'quarantine' || settings.mode === 'enforce') {
                for (const userId of incident.memberIds) {
                    const recentMember = member.guild.members.cache.get(userId);
                    if (recentMember) await this.applyQuarantine(recentMember, settings, incident);
                }
                this.persistIncident(incident);
            }
            return;
        }

        if (!incident) return;
        incident.lastActivityAt = now;
        const isNewCohortMember = !incident.memberIds.has(member.id);
        incident.memberIds.add(member.id);
        if (isNewCohortMember && now - member.user.createdTimestamp <= settings.newAccountAgeMs) {
            incident.newAccountCount++;
        }
        this.scheduleIncidentExpiry(member.guild.id, settings.incidentDurationMs);
        if (settings.mode === 'quarantine' || settings.mode === 'enforce') {
            await this.applyQuarantine(member, settings, incident);
        }
        this.persistIncident(incident);
    }

    async handleMemberUpdate(oldMember, newMember) {
        const incident = this.getActiveIncident(newMember.guild.id);
        if (!incident || !incident.memberIds.has(newMember.id)) return;
        const settings = incident.settings;

        if (settings.protectedRoleId &&
            !oldMember.roles.cache.has(settings.protectedRoleId) &&
            newMember.roles.cache.has(settings.protectedRoleId)) {
            await newMember.roles.remove(
                settings.protectedRoleId,
                `Auto-Ban blocked protected role during ${incident.id}`
            ).then(() => {
                incident.actions.rolesRemoved++;
            }).catch(error => {
                console.warn(`[RAID] Could not remove protected role from ${newMember.id}: ${error.message}`);
            });
        }

        if (settings.releaseAfterScreening && oldMember.pending && !newMember.pending) {
            await this.removeQuarantine(newMember, settings, incident);
        }

        incident.lastActivityAt = Date.now();
        this.scheduleIncidentExpiry(newMember.guild.id, settings.incidentDurationMs);
        this.persistIncident(incident);
    }

    handleMemberRemove(member) {
        const incident = this.getActiveIncident(member.guild.id);
        if (!incident || !incident.memberIds.has(member.id)) return;
        incident.quarantinedIds.delete(member.id);
        incident.actions.membersLeft++;
        incident.lastActivityAt = Date.now();
        this.scheduleIncidentExpiry(member.guild.id, incident.settings.incidentDurationMs);
        this.persistIncident(incident);
    }

    async handleMessage(message) {
        const incident = this.getActiveIncident(message.guild.id);
        if (!incident || !incident.memberIds.has(message.author.id)) return null;

        const fingerprint = createContentFingerprint(message.content);
        if (!fingerprint) return null;

        const now = Date.now();
        const settings = incident.settings;
        const entries = (incident.campaigns.get(fingerprint) || [])
            .filter(entry => now - entry.timestamp <= settings.campaignWindowMs);
        entries.push({ userId: message.author.id, channelId: message.channel.id, timestamp: now });
        incident.campaigns.set(fingerprint, entries);
        this.scheduleCampaignCleanup(incident, fingerprint);
        incident.lastActivityAt = now;
        this.scheduleIncidentExpiry(message.guild.id, settings.incidentDurationMs);

        const participantIds = [...new Set(entries.map(entry => entry.userId))];
        const channelIds = [...new Set(entries.map(entry => entry.channelId))];
        const isCampaign = participantIds.length >= settings.campaignMinAccounts &&
            channelIds.length >= settings.campaignMinChannels;

        if (!isCampaign || incident.detectedFingerprints.has(fingerprint)) {
            return { isCampaign: false, fingerprint, incidentId: incident.id };
        }

        incident.detectedFingerprints.add(fingerprint);
        incident.messageCampaigns++;

        if (settings.mode === 'quarantine' || settings.mode === 'enforce') {
            for (const userId of participantIds) {
                const member = message.guild.members.cache.get(userId);
                if (member) await this.applyQuarantine(member, settings, incident);
            }
        }

        this.persistIncident(incident);
        await this.notify(
            message.guild,
            settings,
            'Coordinated message campaign detected',
            'Members from the active join cohort sent the same normalized payload across multiple channels.',
            [
                { name: 'Incident', value: incident.id, inline: true },
                { name: 'Accounts', value: String(participantIds.length), inline: true },
                { name: 'Channels', value: String(channelIds.length), inline: true }
            ]
        );

        return {
            isCampaign: true,
            enforce: settings.mode === 'enforce',
            fingerprint,
            incidentId: incident.id,
            participantIds,
            channelIds
        };
    }

    markEnforced(guildId) {
        const incident = this.getActiveIncident(guildId);
        if (!incident) return;
        incident.actions.enforced++;
        this.persistIncident(incident);
    }

    refreshSettings(guildId) {
        const incident = this.activeIncidents.get(guildId);
        if (incident) incident.settings = getRaidSettings(guildId);
    }

    async releaseIncidentQuarantine(incident, guild) {
        if (!incident?.settings.quarantineRoleId) return 0;

        let released = 0;
        for (const userId of incident.quarantinedIds) {
            const member = guild.members.cache.get(userId);
            if (!member?.roles.cache.has(incident.settings.quarantineRoleId)) continue;
            try {
                await member.roles.remove(
                    incident.settings.quarantineRoleId,
                    `Auto-Ban raid protection disabled: ${incident.id}`
                );
                released++;
            } catch (error) {
                console.warn(`[RAID] Could not release member ${userId}: ${error.message}`);
            }
        }
        incident.actions.released += released;
        this.persistIncident(incident);
        return released;
    }

    async releaseGuildQuarantine(guild) {
        return this.releaseIncidentQuarantine(this.activeIncidents.get(guild.id), guild);
    }

    async expireIncident(guildId, now = Date.now()) {
        const incident = this.activeIncidents.get(guildId);
        if (!incident || incident.expiring) return false;
        incident.expiring = true;
        if (incident.guild) await this.releaseIncidentQuarantine(incident, incident.guild);
        return this.closeIncident(guildId, 'expired', now);
    }

    forgetUser(userId) {
        for (const [guildId, entries] of this.joinWindows) {
            const filtered = entries.filter(entry => entry.userId !== userId);
            if (filtered.length > 0) this.joinWindows.set(guildId, filtered);
            else this.joinWindows.delete(guildId);
        }

        for (const incident of this.activeIncidents.values()) {
            let changed = incident.memberIds.delete(userId);
            changed = incident.quarantinedIds.delete(userId) || changed;
            for (const [fingerprint, entries] of incident.campaigns) {
                const filtered = entries.filter(entry => entry.userId !== userId);
                if (filtered.length !== entries.length) changed = true;
                if (filtered.length > 0) incident.campaigns.set(fingerprint, filtered);
                else incident.campaigns.delete(fingerprint);
            }
            if (changed) this.persistIncident(incident);
        }
    }

    closeIncident(guildId, reason = 'manual', now = Date.now()) {
        const incident = this.activeIncidents.get(guildId);
        if (!incident) return false;
        incident.status = 'closed';
        incident.endedAt = now;
        incident.reason = reason;
        this.persistIncident(incident);
        this.activeIncidents.delete(guildId);
        this.joinWindows.delete(guildId);
        const joinTimer = this.joinCleanupTimers.get(guildId);
        if (joinTimer) clearTimeout(joinTimer);
        this.joinCleanupTimers.delete(guildId);
        const incidentTimer = this.incidentTimers.get(guildId);
        if (incidentTimer) clearTimeout(incidentTimer);
        this.incidentTimers.delete(guildId);
        for (const [key, timer] of this.campaignTimers) {
            if (!key.startsWith(`${guildId}:`)) continue;
            clearTimeout(timer);
            this.campaignTimers.delete(key);
        }
        return true;
    }

    getStatus(guildId) {
        const settings = getRaidSettings(guildId);
        const incident = this.getActiveIncident(guildId);
        return {
            settings,
            incident: incident ? this.serializeIncident(incident) : null,
            recentJoinCount: (this.joinWindows.get(guildId) || []).length
        };
    }

    async sendTestAlert(guild) {
        const settings = getRaidSettings(guild.id);
        return this.notify(
            guild,
            settings,
            'Raid protection test',
            'This is a safe notification test. No members were modified and no incident data was stored.',
            [
                { name: 'Join threshold', value: String(settings.joinThreshold), inline: true },
                { name: 'Campaign threshold', value: `${settings.campaignMinAccounts} accounts / ${settings.campaignMinChannels} channels`, inline: true }
            ]
        );
    }
}

export const raidDetector = new RaidDetector();
