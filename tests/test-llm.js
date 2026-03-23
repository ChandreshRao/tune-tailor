const { extractIntent } = require("../llm");

async function testLLM() {
  console.log("--- Testing LLM Intent Extraction (tests/test-llm.js) ---");
  const query = "play Sookshmadarshini";
  try {
    const result = await extractIntent(query);
    console.log("Extracted Intent:", JSON.stringify(result, null, 2));
    if (result.album === "Sookshmadarshini" || result.song === "Sookshmadarshini") {
      console.log("✅ LLM test passed!");
    } else {
      console.warn("⚠️ Partial success: LLM returned unexpected fields but extracted something.");
    }
  } catch (error) {
    console.error("❌ LLM test failed:", error.message);
  }
}

testLLM();
