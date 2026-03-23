import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { parseFile } from "music-metadata";
import { 
    saveSong, 
    getAllSongs, 
    getSetting, 
    getSongByHash, 
    updateSongPath, 
    deleteSong,
    getIntentMappingsBySongId
} from '../services/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate a lightweight hash for a file
 */
export async function getFileHash(filePath) {
    const stats = fs.statSync(filePath);
    const size = stats.size;
    
    // For very small files, just hash the whole thing
    if (size < 16384) {
        const buffer = fs.readFileSync(filePath);
        return crypto.createHash('md5').update(buffer).digest('hex');
    }

    // Hash first 8KB, last 8KB, and size
    const fd = fs.openSync(filePath, 'r');
    const first8K = Buffer.alloc(8192);
    const last8K = Buffer.alloc(8192);
    
    fs.readSync(fd, first8K, 0, 8192, 0);
    fs.readSync(fd, last8K, 0, 8192, size - 8192);
    fs.closeSync(fd);
    
    return crypto.createHash('md5')
        .update(first8K)
        .update(last8K)
        .update(size.toString())
        .digest('hex');
}

export async function scanSongs() {
    const songsPath = getSetting('SONGS_PATH') || process.env.SONGS_PATH || './songs';
    const SONGS_DIR = path.resolve(songsPath);

    if (!fs.existsSync(SONGS_DIR)) {
        fs.mkdirSync(SONGS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(SONGS_DIR).filter(file => 
        ['.mp3', '.m4a', '.wav'].includes(path.extname(file).toLowerCase())
    );

    for (const file of files) {
        const filePath = path.join(SONGS_DIR, file);
        const relativePath = file;
        const hash = await getFileHash(filePath);

        try {
            const metadata = await parseFile(filePath);
            const { common } = metadata;

            const song = {
                title: common.title || path.parse(file).name,
                artist: common.artist || "Unknown Artist",
                album: common.album || "Unknown Album",
                path: relativePath,
                hash: hash
            };

            saveSong(song);
        } catch (error) {
            saveSong({
                title: path.parse(file).name,
                artist: "Unknown Artist",
                album: "Unknown Album",
                path: relativePath,
                hash: hash
            });
        }
    }
}

/**
 * Check synchronization status
 */
export async function getSyncStatus() {
    const songsPath = getSetting('SONGS_PATH') || process.env.SONGS_PATH || './songs';
    const SONGS_DIR = path.resolve(songsPath);
    
    if (!fs.existsSync(SONGS_DIR)) return { missing: [], added: [], renames: [] };

    const dbSongs = getAllSongs();
    const diskFiles = fs.readdirSync(SONGS_DIR).filter(f => 
        ['.mp3', '.m4a', '.wav'].includes(path.extname(f).toLowerCase())
    );
    
    const missing = [];
    const added = [];
    const renames = [];
    
    const diskHashes = new Map();
    for (const file of diskFiles) {
        const hash = await getFileHash(path.join(SONGS_DIR, file));
        diskHashes.set(hash, file);
    }
    
    // Find missing and renames
    for (const song of dbSongs) {
        const fullPath = path.join(SONGS_DIR, song.path);
        if (!fs.existsSync(fullPath)) {
            if (diskHashes.has(song.hash)) {
                renames.push({ 
                    id: song.id, 
                    oldPath: song.path, 
                    newPath: diskHashes.get(song.hash),
                    title: song.title 
                });
            } else {
                const mappings = getIntentMappingsBySongId(song.id);
                missing.push({ 
                    id: song.id, 
                    path: song.path, 
                    title: song.title, 
                    mappingsCount: mappings.length,
                    mappings: mappings
                });
            }
        }
    }
    
    // Find truly new files
    const dbPaths = new Set(dbSongs.map(s => s.path));
    const dbHashes = new Set(dbSongs.map(s => s.hash));
    
    for (const file of diskFiles) {
        if (!dbPaths.has(file)) {
            const hash = await getFileHash(path.join(SONGS_DIR, file));
            if (!dbHashes.has(hash)) {
                added.push(file);
            }
        }
    }
    
    return { missing, added, renames };
}

/**
 * Perform the actual synchronization
 */
export async function performSync(force = false) {
    const status = await getSyncStatus();
    
    // 1. Process renames (safe)
    for (const rename of status.renames) {
        updateSongPath(rename.id, rename.newPath);
    }
    
    // 2. Process deletions
    if (status.missing.length > 0) {
        const impact = status.missing.some(m => m.mappingsCount > 0);
        if (impact && !force) {
            return { success: false, requiresConfirmation: true, missing: status.missing };
        }
        
        for (const m of status.missing) {
            deleteSong(m.id);
        }
    }
    
    // 3. Scan for new files
    await scanSongs();
    
    return { success: true, ...status };
}

// Only run if called directly
if (process.argv[1] === __filename) {
  scanSongs().catch(console.error);
}
