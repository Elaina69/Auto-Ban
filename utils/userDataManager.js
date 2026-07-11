import { configManager } from './configManager.js';
import { farmManager } from './farmManager.js';

function removeUserFromArray(value, userId) {
    if (!Array.isArray(value)) {
        return { value, removed: 0 };
    }

    const filtered = value.filter(id => id !== userId);
    return {
        value: filtered,
        removed: value.length - filtered.length
    };
}

class UserDataManager {
    deleteUserData(user) {
        const userId = user.id;
        const userNames = new Set([user.tag, user.username].filter(Boolean));

        const bannedRecords = configManager.updateBannedAccounts(accounts => {
            let removed = 0;

            for (const guildBans of Object.values(accounts)) {
                if (!guildBans || typeof guildBans !== 'object') continue;

                for (const [username, info] of Object.entries(guildBans)) {
                    if (info?.id === userId || userNames.has(username)) {
                        delete guildBans[username];
                        removed++;
                    }
                }
            }

            return removed;
        });

        const serverConfigRecords = configManager.updateServerConfig(serverConfig => {
            const result = {
                whitelist: 0,
                admins: 0,
                adminIds: 0
            };

            for (const settings of Object.values(serverConfig)) {
                if (!settings || typeof settings !== 'object') continue;

                const whitelist = removeUserFromArray(settings.whitelist, userId);
                settings.whitelist = whitelist.value;
                result.whitelist += whitelist.removed;

                const admins = removeUserFromArray(settings.admins, userId);
                settings.admins = admins.value;
                result.admins += admins.removed;

                const adminIds = removeUserFromArray(settings.adminIds, userId);
                settings.adminIds = adminIds.value;
                result.adminIds += adminIds.removed;
            }

            return result;
        });

        const farmDataRecords = farmManager.updateFarmData(farmData => {
            if (Object.prototype.hasOwnProperty.call(farmData, userId)) {
                delete farmData[userId];
                return 1;
            }

            return 0;
        });

        const farmServerRecords = farmManager.updateServerConfig(config => {
            let removed = 0;

            for (const settings of Object.values(config)) {
                if (settings?.enabled && Object.prototype.hasOwnProperty.call(settings.enabled, userId)) {
                    delete settings.enabled[userId];
                    removed++;
                }
            }

            return removed;
        });

        const raidIncidentRecords = configManager.updateRaidIncidents(incidents => {
            let removed = 0;
            for (const guildIncidents of Object.values(incidents)) {
                if (!Array.isArray(guildIncidents)) continue;
                for (const incident of guildIncidents) {
                    if (!Array.isArray(incident.affectedUserIds)) continue;
                    const before = incident.affectedUserIds.length;
                    incident.affectedUserIds = incident.affectedUserIds.filter(id => id !== userId);
                    removed += before - incident.affectedUserIds.length;
                }
            }
            return removed;
        });

        const adminRecords = serverConfigRecords.admins + serverConfigRecords.adminIds;
        const total = bannedRecords +
            serverConfigRecords.whitelist +
            adminRecords +
            farmDataRecords +
            farmServerRecords +
            raidIncidentRecords;

        return {
            total,
            bannedRecords,
            whitelistRecords: serverConfigRecords.whitelist,
            adminRecords,
            farmDataRecords,
            farmServerRecords,
            raidIncidentRecords
        };
    }
}

export const userDataManager = new UserDataManager();
