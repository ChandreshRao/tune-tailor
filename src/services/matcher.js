import similarity from "string-similarity";
import { getAllSongs } from "./database.js";

export function findBestMatch(query) {
  const songs = getAllSongs();
  const searchableFields = [];

  songs.forEach(s => {
    if (s.title) searchableFields.push({ value: s.title, song: s });
    if (s.artist) searchableFields.push({ value: s.artist, song: s });
    if (s.album) searchableFields.push({ value: s.album, song: s });
  });

  const values = searchableFields.map(f => f.value);
  if (values.length === 0) return { type: "none" };

  // 1. Try exact substring match first (most reliable for partial queries)
  const substringMatch = searchableFields.find(f => 
    f.value.toLowerCase().includes(query.toLowerCase())
  );

  if (substringMatch && query.length > 3) {
    return {
      type: "single",
      song: substringMatch.song
    };
  }

  // 2. Fall back to similarity matching
  const match = similarity.findBestMatch(query, values);
  const best = match.bestMatch;

  if (best.rating < 0.3) {
    return { type: "none" };
  }


  const matchedSongs = songs.filter(s => 
    (s.title === best.target) || 
    (s.artist === best.target) || 
    (s.album === best.target)
  );

  if (matchedSongs.length > 1) {
    return {
      type: "multiple",
      options: matchedSongs.slice(0, 5)
    };
  }

  return {
    type: "single",
    song: matchedSongs[0]
  };
}
