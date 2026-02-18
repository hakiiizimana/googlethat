import cors from "cors";
import express from "express";
import { PORT } from "./config/env.js";
import logger from "./utils/logger.js";

const app = express();

app.use(cors());

app.use(express.json());

app.get("/", (_req, res) => {
  res.status(200).json({ message: "GoogleThat API is running" });
});

app.get("/health", (_req, res) => {
  res.status(200).json({ message: "OK", uptime: process.uptime() });
});

app.use((err, _req, res, next) => {
  void next;
  logger.error(err.stack || err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, async () => {
  logger.info(`Server is running on port ${PORT}`);
});
