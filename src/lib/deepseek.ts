import OpenAI from "openai";

/**
 * DeepSeek client (OpenAI-compatible). Pakai untuk semua route teks-only —
 * 10x lebih murah dari Claude Sonnet, kualitas Jepang masih oke.
 *
 * Env: DEEPSEEK_API_KEY di .env.local. Dapetin di https://platform.deepseek.com/api_keys
 *
 * Model:
 *   - "deepseek-chat"     → general, cepat, paling murah (~$0.27/M in, $1.10/M out)
 *   - "deepseek-reasoner" → reasoning (lebih lambat + lebih mahal)
 */
export const DEEPSEEK_MODEL = "deepseek-chat";

export const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});
