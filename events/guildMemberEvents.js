import { raidDetector } from './_raidDetector.js';

export async function handleGuildMemberAdd(member) {
    try {
        await raidDetector.handleMemberAdd(member);
    } catch (error) {
        console.error(`[RAID] GuildMemberAdd failed for guild ${member.guild.id}:`, error);
    }
}

export async function handleGuildMemberUpdate(oldMember, newMember) {
    try {
        await raidDetector.handleMemberUpdate(oldMember, newMember);
    } catch (error) {
        console.error(`[RAID] GuildMemberUpdate failed for guild ${newMember.guild.id}:`, error);
    }
}

export function handleGuildMemberRemove(member) {
    try {
        raidDetector.handleMemberRemove(member);
    } catch (error) {
        console.error(`[RAID] GuildMemberRemove failed for guild ${member.guild.id}:`, error);
    }
}
