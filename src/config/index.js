import dotenv from "dotenv";
dotenv.config();

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
export const MODELS = [
  "gemini-2.0-flash-exp",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro"
];
