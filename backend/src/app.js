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
// 8mb: "Scan receipt" posts the image as a base64 data URL (~1.33× the file
// size), and the UI caps uploads at 2MB.
app.use(express.json({ limit: "8mb" }));
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
