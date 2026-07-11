import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { configManager } from '../../utils/configManager.js';
import { DEFAULT_RAID_SETTINGS, raidDetector } from '../_raidDetector.js';

function ephemeralEmbed(interaction, embed) {
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

function seconds(value, fallback) {
    return value === null ? fallback : value * 1000;
}

function days(value, fallback) {
    return value === null ? fallback : value * 24 * 60 * 60 * 1000;
}

export async function raidCommand(interaction) {
    if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
            content: 'This command requires server Administrator permission.',
            flags: MessageFlags.Ephemeral
        });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (subcommand === 'setup') {
        const previous = raidDetector.getSettings(guildId);
        const mode = interaction.options.getString('mode', true);
        const notifyChannel = interaction.options.getChannel('notifychannel');
        const quarantineRole = interaction.options.getRole('quarantinerole');
        const protectedRole = interaction.options.getRole('protectedrole');
        const serverSettings = configManager.loadServerConfig()[guildId] || {};
        const resolvedNotifyChannelId = notifyChannel?.id || previous.notifyChannelId || serverSettings.notifyChannelId;
        const resolvedQuarantineRoleId = quarantineRole?.id || previous.quarantineRoleId;

        if (!resolvedNotifyChannelId) {
            return interaction.reply({
                content: 'Choose `notifychannel`, or configure a notify channel with `/setup` first.',
                flags: MessageFlags.Ephemeral
            });
        }

        if ((mode === 'quarantine' || mode === 'enforce') && !resolvedQuarantineRoleId) {
            return interaction.reply({
                content: 'Quarantine and enforce modes require `quarantinerole`.',
                flags: MessageFlags.Ephemeral
            });
        }

        const selectedQuarantineRole = resolvedQuarantineRoleId
            ? interaction.guild.roles.cache.get(resolvedQuarantineRoleId)
            : null;
        if (selectedQuarantineRole && (
            selectedQuarantineRole.id === interaction.guild.id ||
            selectedQuarantineRole.position >= interaction.guild.members.me.roles.highest.position
        )) {
            return interaction.reply({
                content: 'The quarantine role must be below the bot\'s highest role and cannot be `@everyone`.',
                flags: MessageFlags.Ephemeral
            });
        }

        const resolvedProtectedRoleId = protectedRole?.id || previous.protectedRoleId;
        if (resolvedProtectedRoleId && resolvedProtectedRoleId === resolvedQuarantineRoleId) {
            return interaction.reply({
                content: 'The protected role and quarantine role must be different.',
                flags: MessageFlags.Ephemeral
            });
        }
        const selectedProtectedRole = resolvedProtectedRoleId
            ? interaction.guild.roles.cache.get(resolvedProtectedRoleId)
            : null;
        if (selectedProtectedRole && selectedProtectedRole.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({
                content: 'The protected role must be below the bot\'s highest role.',
                flags: MessageFlags.Ephemeral
            });
        }

        const settings = {
            ...previous,
            enabled: true,
            mode,
            notifyChannelId: resolvedNotifyChannelId,
            quarantineRoleId: resolvedQuarantineRoleId,
            protectedRoleId: resolvedProtectedRoleId,
            joinThreshold: interaction.options.getInteger('jointhreshold') ?? previous.joinThreshold,
            joinWindowMs: seconds(interaction.options.getInteger('joinwindow'), previous.joinWindowMs),
            campaignMinAccounts: interaction.options.getInteger('campaignaccounts') ?? previous.campaignMinAccounts,
            campaignMinChannels: interaction.options.getInteger('campaignchannels') ?? previous.campaignMinChannels,
            campaignWindowMs: seconds(interaction.options.getInteger('campaignwindow'), previous.campaignWindowMs),
            newAccountAgeMs: days(interaction.options.getInteger('newaccountdays'), previous.newAccountAgeMs),
            incidentRetentionDays: interaction.options.getInteger('retentiondays') ?? previous.incidentRetentionDays,
            releaseAfterScreening: interaction.options.getBoolean('releaseafterscreening') ?? previous.releaseAfterScreening
        };

        configManager.updateServerConfig(config => {
            if (!config[guildId]) config[guildId] = {};
            config[guildId].raidProtection = settings;
        });
        raidDetector.refreshSettings(guildId);

        const embed = new EmbedBuilder()
            .setColor(0x00a86b)
            .setTitle('Raid protection configured')
            .addFields(
                { name: 'Mode', value: settings.mode, inline: true },
                { name: 'Join burst', value: `${settings.joinThreshold} members / ${settings.joinWindowMs / 1000}s`, inline: true },
                { name: 'Message campaign', value: `${settings.campaignMinAccounts} accounts / ${settings.campaignMinChannels} channels / ${settings.campaignWindowMs / 1000}s`, inline: false },
                { name: 'Quarantine role', value: settings.quarantineRoleId ? `<@&${settings.quarantineRoleId}>` : 'Not configured', inline: true },
                { name: 'Role setup', value: settings.quarantineRoleId ? 'Configure channel permission overwrites for the quarantine role.' : 'No role action in alert mode.', inline: false },
                { name: 'Incident retention', value: `${settings.incidentRetentionDays} days`, inline: true }
            )
            .setTimestamp();
        return ephemeralEmbed(interaction, embed);
    }

    if (subcommand === 'disable') {
        await raidDetector.releaseGuildQuarantine(interaction.guild);
        configManager.updateServerConfig(config => {
            if (!config[guildId]) config[guildId] = {};
            config[guildId].raidProtection = {
                ...(config[guildId].raidProtection || DEFAULT_RAID_SETTINGS),
                enabled: false,
                mode: 'off'
            };
        });
        raidDetector.closeIncident(guildId, 'disabled_by_admin');
        return interaction.reply({ content: 'Raid protection disabled.', flags: MessageFlags.Ephemeral });
    }

    if (subcommand === 'test') {
        const sent = await raidDetector.sendTestAlert(interaction.guild);
        return interaction.reply({
            content: sent
                ? 'Safe raid alert sent. No member was changed and no incident was stored.'
                : 'Could not send the raid alert. Check the configured channel and `View Channel`/`Send Messages` permissions.',
            flags: MessageFlags.Ephemeral
        });
    }

    if (subcommand === 'incidents') {
        const incidents = (configManager.loadRaidIncidents()[guildId] || []).slice(-5).reverse();
        const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('Recent raid incidents')
            .setDescription(incidents.length > 0
                ? incidents.map(item =>
                    `**${item.incidentId}** - ${item.status}\n` +
                    `${item.joinCount} joins, ${item.messageCampaigns} campaigns, started <t:${Math.floor(Date.parse(item.startedAt) / 1000)}:R>`
                ).join('\n\n')
                : 'No retained raid incidents for this server.')
            .setTimestamp();
        return ephemeralEmbed(interaction, embed);
    }

    const { settings, incident, recentJoinCount } = raidDetector.getStatus(guildId);
    const embed = new EmbedBuilder()
        .setColor(settings.enabled ? 0x00a86b : 0x808080)
        .setTitle('Raid protection status')
        .addFields(
            { name: 'Enabled', value: settings.enabled ? 'Yes' : 'No', inline: true },
            { name: 'Mode', value: settings.mode, inline: true },
            { name: 'Recent joins in memory', value: String(recentJoinCount), inline: true },
            { name: 'Join threshold', value: `${settings.joinThreshold} / ${settings.joinWindowMs / 1000}s`, inline: true },
            { name: 'Campaign threshold', value: `${settings.campaignMinAccounts} accounts / ${settings.campaignMinChannels} channels`, inline: true },
            { name: 'Active incident', value: incident?.incidentId || 'None', inline: false }
        )
        .setTimestamp();
    return ephemeralEmbed(interaction, embed);
}
