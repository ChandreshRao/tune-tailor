import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Move up from src/services to root
const dbDir = path.join(__dirname, "..", "..", "db");
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "tune-tailor.db");
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT,
    album TEXT,
    path TEXT UNIQUE NOT NULL,
    hash TEXT
  );
`);

// Migration: Add hash column if it doesn't exist
try {
    db.exec("ALTER TABLE songs ADD COLUMN hash TEXT");
} catch (e) {
    // Column already exists
}

db.exec(`
  CREATE TABLE IF NOT EXISTS intent_mappings (
    query TEXT PRIMARY KEY,
    intent TEXT NOT NULL,
    song_name TEXT,
    song_id INTEGER,
    FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE CASCADE
  );
`);

// Migration: Move data from music_intent_cache to intent_mappings if exists
try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='music_intent_cache'").get();
    if (tableExists) {
        db.exec("INSERT OR IGNORE INTO intent_mappings SELECT * FROM music_intent_cache");
        db.exec("DROP TABLE music_intent_cache");
    }
} catch (e) {
    console.error("Migration error:", e);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Seed default settings if not exists
const seed = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
seed.run('SONGS_PATH', process.env.SONGS_PATH || './songs');
seed.run('BASE_URL', process.env.BASE_URL || 'http://localhost:3000');
seed.run('GEMINI_API_KEY', process.env.GEMINI_API_KEY || '');
seed.run('GEMINI_MODELS', 'gemini-2.0-flash,gemini-1.5-flash,gemini-1.5-pro');
seed.run('UI_REFRESH_INTERVAL', '30');

/**
 * Get cached intent for a query
 */
export function getIntentMapping(query) {
  const stmt = db.prepare("SELECT * FROM intent_mappings WHERE query = ?");
  return stmt.get(query.toLowerCase().trim());
}

/**
 * Save a successful intent mapping
 */
export function saveIntentMapping(query, intent, song) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO intent_mappings (query, intent, song_name, song_id)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(query.toLowerCase().trim(), intent, song.title, song.id);
}

/**
 * Get all cached intent mappings
 */
export function getAllIntentMappings() {
  const stmt = db.prepare(`
    SELECT m.*, s.path as song_path 
    FROM intent_mappings m 
    LEFT JOIN songs s ON m.song_id = s.id 
    ORDER BY m.query ASC
  `);
  return stmt.all();
}

/**
 * Update an existing intent mapping
 */
export function updateIntentMapping(oldQuery, newQuery, intent, song_name, song_id) {
  const stmt = db.prepare(`
    UPDATE intent_mappings 
    SET query = ?, intent = ?, song_name = ?, song_id = ?
    WHERE query = ?
  `);
  return stmt.run(newQuery, intent, song_name, song_id, oldQuery);
}

/**
 * Songs Management
 */

export function getAllSongs() {
  const stmt = db.prepare("SELECT * FROM songs ORDER BY title ASC");
  return stmt.all();
}

export function saveSong(song) {
  const stmt = db.prepare(`
    INSERT INTO songs (title, artist, album, path, hash)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      title = excluded.title,
      artist = excluded.artist,
      album = excluded.album,
      hash = excluded.hash
  `);
  return stmt.run(song.title, song.artist, song.album, song.path, song.hash);
}

export function updateSongPath(id, newPath) {
  const stmt = db.prepare("UPDATE songs SET path = ? WHERE id = ?");
  return stmt.run(newPath, id);
}

export function getSongByHash(hash) {
  return db.prepare("SELECT * FROM songs WHERE hash = ?").get(hash);
}

export function getIntentMappingsBySongId(songId) {
  return db.prepare("SELECT * FROM intent_mappings WHERE song_id = ?").all(songId);
}

export function updateSong(id, title, artist, album) {
  const stmt = db.prepare(`
    UPDATE songs 
    SET title = ?, artist = ?, album = ?
    WHERE id = ?
  `);
  return stmt.run(title, artist, album, id);
}
// Settings
export function getSettings() {
    return db.prepare('SELECT * FROM settings').all();
}

export function getSetting(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
}

export function saveSetting(key, value) {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    stmt.run(key, value);
}

export function deleteSong(id) {
  const songStmt = db.prepare("SELECT path FROM songs WHERE id = ?");
  const song = songStmt.get(id);
  
  const stmt = db.prepare("DELETE FROM songs WHERE id = ?");
  stmt.run(id);
  
  return song ? song.path : null;
}

export function getSongById(id) {
  return db.prepare("SELECT * FROM songs WHERE id = ?").get(id);
}

/**
 * Delete an intent mapping
 */
export function deleteIntentMapping(query) {
  const stmt = db.prepare("DELETE FROM intent_mappings WHERE query = ?");
  return stmt.run(query);
}

/**
 * Cleanup missing songs from DB
 */
export function cleanupSongs(existingPaths) {
  const placeholders = existingPaths.map(() => "?").join(",");
  const stmt = db.prepare(`DELETE FROM songs WHERE path NOT IN (${placeholders})`);
  return stmt.run(...existingPaths);
}
