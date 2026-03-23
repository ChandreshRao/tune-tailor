import axios from "axios";
import * as config from "../config/index.js";
import * as appConstants from "../config/constants.js";
import { getSetting } from './database.js';

export async function extractIntent(userInput) {
  const apiKey = getSetting('GEMINI_API_KEY') || config.GEMINI_API_KEY;
  const modelsStr = getSetting('GEMINI_MODELS') || 'gemini-2.0-flash-exp,gemini-1.5-flash,gemini-1.5-pro';
  const models = modelsStr.split(',').map(m => m.trim());
  
  const intentList = appConstants.INTENTS.map(i => i.id).join(" | ");
  const prompt = `
  Extract intent from this request:
  "${userInput}"

  Return JSON:
  {
    "intent": "${intentList}",
    "song": string | null,
    "artist": string | null,
    "album": string | null,
    "playlist": string | null,
    "confidence": number,
    "needs_clarification": boolean,
    "clarification_question": string | null
  }
  `;

  for (const model of models) {
    try {
      console.log(`Trying model: ${model}...`);
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }]
        }
      );

      const text = response.data.candidates[0].content.parts[0].text;
      const cleanedText = text.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanedText);
    } catch (error) {
      console.warn(`Model ${model} failed: ${error.message}`);
      // Continue to next model
    }
  }

  return {
    intent: "unknown",
    needs_clarification: true,
    clarification_question: "Could not understand request after trying all models"
  };
}
