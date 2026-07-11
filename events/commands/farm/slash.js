import { Collection, MessageFlags } from 'discord.js';
import { farmManager } from '../../../utils/farmManager.js';
import { farmEnableCommand } from './enable.js';
import { handleFarmHelp } from './help.js';
import { handleFarmLogin } from './login.js';
import { handleFarmStatus } from './status.js';
import { handleFarmGrow } from './grow.js';
import { handleFarmHarvest } from './harvest.js';
import { handleFarmInfo } from './info.js';
import { handleFarmSell } from './sell.js';
import { handleFarmExpand } from './expand.js';
import { handleCropList } from './cropList.js';
import { handleFarmBuy } from './buy.js';
import { handleRoleList, handleRoleBuy } from './roleShop.js';

function normalizeReplyPayload(payload) {
    return typeof payload === 'string' ? { content: payload } : payload;
}

function createUserMentionCollection(user) {
    const users = new Collection();
    if (user) {
        users.set(user.id, user);
    }

    return users;
}

function createFarmMessageAdapter(interaction, { targetUser = null } = {}) {
    return {
        author: interaction.user,
        guild: interaction.guild,
        channel: interaction.channel,
        client: interaction.client,
        content: '',
        attachments: new Collection(),
        createdTimestamp: Date.now(),
        mentions: {
            users: createUserMentionCollection(targetUser)
        },
        async reply(payload) {
            const options = normalizeReplyPayload(payload);
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply(options);
                return interaction.fetchReply();
            }

            return interaction.followUp(options);
        }
    };
}

function getOptionalString(interaction, name, fallback = null) {
    const value = interaction.options.getString(name);
    return value?.trim?.() || fallback;
}

async function replyFarmDisabled(interaction) {
    await interaction.reply({
        content: 'Farming mode is disabled for you in this server. Use `/farm enable` to turn it back on.',
        flags: MessageFlags.Ephemeral
    });
}

export async function farmSlashCommand(interaction) {
    if (!interaction.inGuild()) {
        await interaction.reply({
            content: 'Farm commands can only be used inside a server.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    if (subcommand === 'enable' || subcommand === 'disable') {
        await farmEnableCommand(interaction, subcommand);
        return;
    }

    if (!farmManager.isFarmingEnabled(userId, guildId)) {
        await replyFarmDisabled(interaction);
        return;
    }

    switch (subcommand) {
        case 'help': {
            await handleFarmHelp(createFarmMessageAdapter(interaction));
            break;
        }
        case 'login': {
            await handleFarmLogin(createFarmMessageAdapter(interaction));
            break;
        }
        case 'status': {
            const targetUser = interaction.options.getUser('user');
            const message = createFarmMessageAdapter(interaction, { targetUser });
            await handleFarmStatus(message, targetUser ? [targetUser.username] : []);
            break;
        }
        case 'grow': {
            await handleFarmGrow(createFarmMessageAdapter(interaction), [
                interaction.options.getString('crop', true)
            ]);
            break;
        }
        case 'harvest': {
            await handleFarmHarvest(createFarmMessageAdapter(interaction));
            break;
        }
        case 'sell': {
            await handleFarmSell(createFarmMessageAdapter(interaction), [
                interaction.options.getString('crop', true),
                getOptionalString(interaction, 'amount', 'all')
            ]);
            break;
        }
        case 'buy': {
            const args = [interaction.options.getString('crop', true)];
            const quantity = getOptionalString(interaction, 'quantity');
            if (quantity) args.push(quantity);

            await handleFarmBuy(createFarmMessageAdapter(interaction), args);
            break;
        }
        case 'expand': {
            await handleFarmExpand(createFarmMessageAdapter(interaction));
            break;
        }
        case 'crops': {
            await handleCropList(createFarmMessageAdapter(interaction), [
                getOptionalString(interaction, 'sort', 'sell')
            ]);
            break;
        }
        case 'info': {
            const crop = getOptionalString(interaction, 'crop');
            await handleFarmInfo(createFarmMessageAdapter(interaction), crop ? [crop] : []);
            break;
        }
        case 'role-list': {
            await handleRoleList(createFarmMessageAdapter(interaction));
            break;
        }
        case 'role-buy': {
            const role = interaction.options.getRole('role', true);
            await handleRoleBuy(createFarmMessageAdapter(interaction), [role.name]);
            break;
        }
        default:
            await interaction.reply({
                content: 'Unknown farm subcommand.',
                flags: MessageFlags.Ephemeral
            });
    }
}
