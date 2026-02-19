import cors from "cors";
import express from "express";
import { PORT } from "./config/env.js";
import logger from "./utils/logger.js";
import { buildUrl, getPayload, searchGoogle } from "./googlethat.js";

const app = express();

app.use(cors());

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({ message: "GoogleThat API is running" });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ message: "OK", uptime: process.uptime() });
});

app.post("/search", async (req, res, next) => {
  try {
    const { query, tbs, hl, gl, page } = req.body;

    const url = buildUrl({ query, tbs, hl, gl, page });
    const payload = getPayload(url.url);
    const results = await searchGoogle(payload);

    if (!results) {
      return res.status(200).json({ message: "No results found" });
    }

    res.status(200).json({
      searchParams: url.params,
      results,
    });
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, next) => {
  void next;
  logger.error(err.stack || err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
