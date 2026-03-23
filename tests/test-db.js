const { getCachedIntent, saveIntentMapping } = require("../database");

function testDB() {
  console.log("--- Testing SQLite Database (tests/test-db.js) ---");
  const query = "test-query-" + Date.now();
  
  const mockSong = { id: 1, title: "Dhurooha-Manthahasame" };
  saveIntentMapping(query, "play_song", mockSong);
  console.log(`Saved mapping for '${query}'`);

  const result = getCachedIntent(query);
  console.log("Retrieve result:", result);

  if (result && result.song_name === "Dhurooha-Manthahasame") {
    console.log("✅ Database test passed!");
  } else {
    console.error("❌ Database test failed!");
    process.exit(1);
  }
}

testDB();
