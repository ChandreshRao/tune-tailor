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

  const lowerQuery = query.toLowerCase();

  // 1. Try exact substring match or word-prefix match
  const substringMatch = searchableFields.find(f => {
    const val = f.value.toLowerCase();
    // Direct substring
    if (val.includes(lowerQuery)) return true;
    
    // Word-prefix match (e.g., "Kanta" matches "Kantha" if we consider common prefix)
    // Or just check if any word starts with the query
    const words = val.split(/[\s-_(),.]+/);
    return words.some(word => word.startsWith(lowerQuery) || lowerQuery.startsWith(word));
  });

  if (substringMatch && query.length >= 3) {
    return {
      type: "single",
      song: substringMatch.song
    };
  }

  // 2. Fall back to similarity matching
  const match = similarity.findBestMatch(query, values);
  const best = match.bestMatch;

  // Lowered threshold to catch phonetic variations (e.g. Kanta vs Kantha)
  if (best.rating < 0.2) {
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
