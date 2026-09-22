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
// 32mb: "Scan receipt" posts the image as a base64 data URL (~1.33× the file
// size), and the UI caps uploads at 2MB. Saving the Add Expenses form posts
// every scanned draft with its image in one payload, so leave a little more
// headroom than a single image needs.
app.use(express.json({ limit: "32mb" }));
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
