import express from "express";
import cors from "cors";
import { apiRouter } from "./routes";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import { generalLimiter } from "./middleware/rateLimiter";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);
  app.use(generalLimiter);

  app.get("/", (_req, res) => {
    res.json({ message: "API running successfully" });
  });

  app.use("/api", apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
