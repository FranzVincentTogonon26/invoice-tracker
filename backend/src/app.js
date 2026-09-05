import express from "express";
import cors from "cors";

import { ENV } from "./config/env.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.handler.middleware.js";
import apiRoutes from "./routes/index.js";

const app = express();

app.use(
  cors({
    origin: ENV.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    name: "Invoice Tracker API",
    status: "running",
    version: "1.0.0",
  });
});

app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
