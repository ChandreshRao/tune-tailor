import { findBestMatch } from "../src/services/matcher.js";

const query = "mandahasame";
console.log(`Testing query: ${query}`);
const result = findBestMatch(query);
console.log("Result:", JSON.stringify(result, null, 2));
