import fs from 'fs';
import path from 'path';
import { inflateRawSync } from 'zlib';

const CRC_TABLE = new Uint32Array(256);

for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    CRC_TABLE[i] = crc >>> 0;
}

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date = new Date()) {
    const year = Math.max(date.getFullYear(), 1980);
    const dosTime =
        (date.getHours() << 11) |
        (date.getMinutes() << 5) |
        Math.floor(date.getSeconds() / 2);
    const dosDate =
        ((year - 1980) << 9) |
        ((date.getMonth() + 1) << 5) |
        date.getDate();

    return { dosDate, dosTime };
}

function normalizeEntryName(name) {
    return name.replace(/\\/g, '/').replace(/^\/+/, '');
}

function listFilesRecursive(dir, rootDir = dir) {
    if (!fs.existsSync(dir)) return [];

    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...listFilesRecursive(fullPath, rootDir));
        } else if (entry.isFile()) {
            files.push({
                fullPath,
                relativePath: normalizeEntryName(path.relative(rootDir, fullPath))
            });
        }
    }

    return files;
}

export function buildZipFromDirectory(sourceDir, options = {}) {
    const rootName = normalizeEntryName(options.rootName || path.basename(sourceDir));
    const shouldInclude = options.filter || (() => true);
    const now = new Date();
    const { dosDate, dosTime } = getDosDateTime(now);

    const localParts = [];
    const centralParts = [];
    let offset = 0;
    let fileCount = 0;

    for (const file of listFilesRecursive(sourceDir)) {
        if (!shouldInclude(file.fullPath, file.relativePath)) continue;

        const data = fs.readFileSync(file.fullPath);
        const entryName = normalizeEntryName(`${rootName}/${file.relativePath}`);
        const nameBuffer = Buffer.from(entryName, 'utf8');
        const checksum = crc32(data);

        const localHeader = Buffer.alloc(30 + nameBuffer.length);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0x0800, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(dosTime, 10);
        localHeader.writeUInt16LE(dosDate, 12);
        localHeader.writeUInt32LE(checksum, 14);
        localHeader.writeUInt32LE(data.length, 18);
        localHeader.writeUInt32LE(data.length, 22);
        localHeader.writeUInt16LE(nameBuffer.length, 26);
        localHeader.writeUInt16LE(0, 28);
        nameBuffer.copy(localHeader, 30);

        localParts.push(localHeader, data);

        const centralHeader = Buffer.alloc(46 + nameBuffer.length);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0x0800, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(dosTime, 12);
        centralHeader.writeUInt16LE(dosDate, 14);
        centralHeader.writeUInt32LE(checksum, 16);
        centralHeader.writeUInt32LE(data.length, 20);
        centralHeader.writeUInt32LE(data.length, 24);
        centralHeader.writeUInt16LE(nameBuffer.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);
        nameBuffer.copy(centralHeader, 46);

        centralParts.push(centralHeader);
        offset += localHeader.length + data.length;
        fileCount++;
    }

    const centralOffset = offset;
    const centralDirectory = Buffer.concat(centralParts);
    const centralSize = centralDirectory.length;

    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(0x06054b50, 0);
    endRecord.writeUInt16LE(0, 4);
    endRecord.writeUInt16LE(0, 6);
    endRecord.writeUInt16LE(fileCount, 8);
    endRecord.writeUInt16LE(fileCount, 10);
    endRecord.writeUInt32LE(centralSize, 12);
    endRecord.writeUInt32LE(centralOffset, 16);
    endRecord.writeUInt16LE(0, 20);

    return {
        buffer: Buffer.concat([...localParts, centralDirectory, endRecord]),
        fileCount
    };
}

function findEndOfCentralDirectory(buffer) {
    const minOffset = Math.max(0, buffer.length - 22 - 0xffff);
    for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) {
            return offset;
        }
    }
    return -1;
}

export function readZipEntry(zipFile, entryName) {
    const targetName = normalizeEntryName(entryName);
    const buffer = fs.readFileSync(zipFile);
    const endOffset = findEndOfCentralDirectory(buffer);

    if (endOffset === -1) {
        throw new Error(`Invalid zip file: ${zipFile}`);
    }

    const totalEntries = buffer.readUInt16LE(endOffset + 10);
    let centralOffset = buffer.readUInt32LE(endOffset + 16);

    for (let index = 0; index < totalEntries; index++) {
        if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) {
            throw new Error(`Invalid central directory in zip: ${zipFile}`);
        }

        const method = buffer.readUInt16LE(centralOffset + 10);
        const compressedSize = buffer.readUInt32LE(centralOffset + 20);
        const nameLength = buffer.readUInt16LE(centralOffset + 28);
        const extraLength = buffer.readUInt16LE(centralOffset + 30);
        const commentLength = buffer.readUInt16LE(centralOffset + 32);
        const localOffset = buffer.readUInt32LE(centralOffset + 42);
        const name = buffer.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString('utf8');

        if (normalizeEntryName(name) === targetName) {
            if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
                throw new Error(`Invalid local header in zip: ${zipFile}`);
            }

            const localNameLength = buffer.readUInt16LE(localOffset + 26);
            const localExtraLength = buffer.readUInt16LE(localOffset + 28);
            const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
            const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);

            if (method === 0) {
                return Buffer.from(compressedData);
            }
            if (method === 8) {
                return inflateRawSync(compressedData);
            }

            throw new Error(`Unsupported zip compression method ${method} for ${name}`);
        }

        centralOffset += 46 + nameLength + extraLength + commentLength;
    }

    return null;
}
