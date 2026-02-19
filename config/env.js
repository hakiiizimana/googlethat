import { config } from "dotenv";

config({ path: ".env" });

export const PORT = process.env.PORT || 5000;
export const CRAWL4AI_URL =
  process.env.CRAWL4AI_URL || "https://crawl4ai.siirathic.com";
