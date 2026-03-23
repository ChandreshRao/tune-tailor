import express from "express";
import fs from "fs";
import cors from "cors";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import * as config from "./config/index.js";
import { extractIntent } from "./services/llm.js";
import { findBestMatch } from "./services/matcher.js";
import {
  getIntentMapping,
  saveIntentMapping,
  getAllIntentMappings,
  updateIntentMapping,
  deleteIntentMapping,
  getAllSongs,
  getSongById,
  saveSong,
  updateSong,
  deleteSong,
  getSettings,
  getSetting,
  saveSetting
} from "./services/database.js";
import { scanSongs, performSync } from "./utils/scanner.js";
import { INTENTS } from "./config/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const lastLoggedStreams = new Map(); // For log de-duplication


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
// Dynamic serving for songs folder
app.use('/songs', (req, res, next) => {
    const songsPath = getSetting('SONGS_PATH') || process.env.SONGS_PATH || './songs';
    express.static(path.resolve(songsPath))(req, res, next);
});

const PORT = 3000;

// Multer configuration for song uploads
const upload = multer({ dest: 'uploads/' });

/**
 * 🎤 Alexa/Client hits this endpoint to play a song
 */
app.post("/play", async (req, res) => {
  const userInput = req.body.query;
  console.log("User query:", userInput);

  try {
    const cached = getIntentMapping(userInput);
    if (cached) {
      const audioUrl = `${config.BASE_URL}/stream?id=${cached.song_id}`;
      console.log("🚀 Cache Hit:", cached.song_name, "| URL:", audioUrl);
      return res.json({
        type: "play",
        audioUrl: audioUrl,
        title: cached.song_name
      });
    }

    console.log("⚡ Cache Miss. Calling LLM...");
    let intent;
    try {
      intent = await extractIntent(userInput);
      console.log("Extracted intent:", JSON.stringify(intent, null, 2));
    } catch (llmError) {
      console.warn("LLM Extraction failed, falling back to local search:", llmError.message);
      intent = { needs_clarification: true }; // Force fallback
    }

    if (intent.needs_clarification) {
      console.log("LLM unclear or failed. Trying direct local search fallback...");
      const fallbackResult = findBestMatch(userInput);
      if (fallbackResult.type === "single") {
        const song = fallbackResult.song;
        const audioUrl = `${config.BASE_URL}/stream?id=${song.id}`;
        console.log("✅ Local fallback success:", song.title, "| URL:", audioUrl);
        
        // Return play response immediately
        res.json({
          type: "play",
          audioUrl: audioUrl,
          title: song.title
        });

        // Still save to cache for next time
        try {
          saveIntentMapping(userInput, "play_music", song);
        } catch (e) {}
        return;
      }

      console.warn("❌ Local fallback failed to find a unique match:", fallbackResult.type);

      return res.json({
        type: "clarification",
        message: intent.clarification_question || "Could not find a match for your request."
      });
    }


    const searchEntity = intent.song || intent.album || intent.artist || userInput;

    console.log("Searching for:", searchEntity);

    if (!searchEntity) {
      return res.json({
        type: "error",
        message: "Could not identify song, artist, or album"
      });
    }

    const result = findBestMatch(searchEntity);
    console.log("Match result:", JSON.stringify(result, null, 2));

    if (result.type === "none") {
      return res.json({
        type: "error",
        message: "Song not found"
      });
    }

    if (result.type === "multiple") {
      return res.json({
        type: "clarification",
        message: "Multiple songs found",
        options: result.options
      });
    }

    const song = result.song;
    const audioUrl = `${config.BASE_URL}/stream?id=${song.id}`;
    console.log("🎵 Match found:", song.title, "| URL:", audioUrl);

    res.json({
      type: "play",
      audioUrl: audioUrl,
      title: song.title
    });

    try {
      saveIntentMapping(userInput, intent.intent, song);
      console.log("📖 Learned new mapping:", userInput, "->", song.title);
    } catch (cacheError) {
      console.warn("Failed to save to cache:", cacheError.message);
    }
  } catch (error) {
    console.error("Error in /play:", error);
    res.status(500).json({ type: "error", message: "Internal server error" });
  }
});

/**
 * 🎧 Streaming endpoint
 */
app.get('/stream', (req, res) => {
    const { id } = req.query;
    const song = getSongById(parseInt(id));

    if (!song) return res.status(404).send('Song not found');

    const songsPath = getSetting('SONGS_PATH') || process.env.SONGS_PATH || './songs';
    const fullPath = path.resolve(songsPath, song.path);
    const range = req.headers.range;

    // Log de-duplication (only log once every 10 seconds per song)
    const now = Date.now();
    const lastLog = lastLoggedStreams.get(id);
    if (!lastLog || (now - lastLog > 10000)) {
        console.log(`[Stream] ID: ${id} | Title: ${song.title} | Range: ${range || 'Full File'}`);
        lastLoggedStreams.set(id, now);
    }

    if (!fs.existsSync(fullPath)) {
        console.error("[Stream] File NOT FOUND:", fullPath);
        return res.sendStatus(404);
    }

    const stat = fs.statSync(fullPath);

    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0]);
        const end = parts[1] ? parseInt(parts[1]) : stat.size - 1;

        const chunkSize = end - start + 1;
        const stream = fs.createReadStream(fullPath, { start, end });

        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunkSize,
            "Content-Type": "audio/mpeg"
        });

        stream.on('error', (err) => {
            console.warn(`[Stream] Error during range pipe (ID: ${id}): ${err.message}`);
        });

        stream.pipe(res);
    } else {
        res.writeHead(200, {
            "Content-Length": stat.size,
            "Content-Type": "audio/mpeg"
        });

        const stream = fs.createReadStream(fullPath);
        
        stream.on('error', (err) => {
            console.warn(`[Stream] Error during full pipe (ID: ${id}): ${err.message}`);
        });

        stream.pipe(res);
    }

});

/**
 * 📂 UI / Management Endpoints
 */

// Config endpoints
app.get("/api/config/intents", (req, res) => {
  res.json(INTENTS);
});

// List all indexed songs
app.get("/api/songs", (req, res) => {
  try {
    const songs = getAllSongs();
    res.json(songs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update song metadata
app.put("/api/songs/:id", (req, res) => {
  const { id } = req.params;
  const { title, artist, album } = req.body;
  try {
    updateSong(parseInt(id), title, artist, album);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a song
app.delete("/api/songs/:id", (req, res) => {
  const { id } = req.params;
  try {
    const relativePath = deleteSong(parseInt(id));
    if (relativePath) {
      const songsPath = getSetting('SONGS_PATH') || process.env.SONGS_PATH || './songs';
      const fullPath = path.resolve(songsPath, relativePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all intent mappings
app.get("/api/intents", (req, res) => {
  try {
    const mappings = getAllIntentMappings();
    res.json(mappings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new intent mapping
app.post("/api/intents", (req, res) => {
  const { query, intent, song_id, song_name } = req.body;
  try {
    const song = { id: song_id, title: song_name };
    saveIntentMapping(query, intent, song);
    res.json({ success: true });
  } catch (error) {
    console.error("Add error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update an intent mapping
app.put("/api/intents/:oldQuery", (req, res) => {
  const { oldQuery } = req.params;
  const { query, intent, song_name, song_id } = req.body;
  try {
    updateIntentMapping(oldQuery, query, intent, song_name, song_id);
    res.json({ success: true });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete an intent mapping
app.delete("/api/intents/:query", (req, res) => {
  const { query } = req.params;
  try {
    deleteIntentMapping(query);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload song
app.post('/api/upload', upload.array('songs'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        const songsPath = getSetting('SONGS_PATH') || process.env.SONGS_PATH || './songs';
        if (!fs.existsSync(songsPath)) {
            fs.mkdirSync(songsPath, { recursive: true });
        }

        for (const file of req.files) {
            const fileName = file.originalname;
            const targetPath = path.join(songsPath, fileName);

            // Multer's dest is 'uploads/', so file.path is like 'uploads/xyz'
            // We need to move it from 'uploads/xyz' to 'songsPath/fileName'
            fs.renameSync(file.path, targetPath);
        }

        await scanSongs();
        res.json({ success: true, count: req.files.length });
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Sync Songs
app.post('/api/songs/sync', async (req, res) => {
    try {
        const { force } = req.body;
        const result = await performSync(force);
        res.json(result);
    } catch (error) {
        console.error("Sync error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Settings Endpoints
app.get('/api/settings', (req, res) => {
    try {
        const settings = getSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/settings', (req, res) => {
    try {
        const { key, value } = req.body;
        saveSetting(key, value);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
