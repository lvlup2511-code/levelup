/**
 * Standalone test for Gemini API. Loads .env.local and sends "Hello" to the model.
 * Run: node test-gemini.mjs
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = join(__dirname, ".env.local");
if (!existsSync(envPath)) {
  console.error("ERROR: .env.local not found at", envPath);
  process.exit(1);
}
const raw = readFileSync(envPath, "utf8");
const env = {};
for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    val = val.slice(1, -1);
  env[key] = val;
}
const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  console.error("ERROR: GOOGLE_GENERATIVE_AI_API_KEY not found in .env.local");
  process.exit(1);
}
process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

console.log("API key loaded. First 5 chars:", apiKey.slice(0, 5) + "...");
console.log("Key length:", apiKey.length);

const require = createRequire(import.meta.url);
const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODELS_TO_TRY = ["gemini-3.1-flash-lite-preview"];

async function testModel(modelName) {
  console.log("\n--- Testing model:", modelName, "---");
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Say exactly: Hello");
    const response = result.response;
    const text = typeof response?.text === "function" ? response.text() : (response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "?");
    console.log("SUCCESS. Response:", String(text).slice(0, 80));
    return true;
  } catch (err) {
    console.log("FAILED:", err.message);
    if (err.response) console.log("  Response status:", err.response.status, err.response.statusText);
    return false;
  }
}

(async () => {
  console.log("Testing Gemini API with .env.local key...");
  for (const modelName of MODELS_TO_TRY) {
    const ok = await testModel(modelName);
    if (ok) {
      console.log("\n>>> Working model:", modelName);
      process.exit(0);
    }
  }
  console.log("\n>>> All models failed. Check API key and region.");
  process.exit(1);
})();
