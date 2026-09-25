import express from "express";
import cors from "cors";

import { ENV } from "./config/env.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.handler.middleware.js";
import apiRoutes from "./routes/index.js";
import { UPLOADS_ROOT } from "./utils/receiptImage.js";

const app = express();

app.use(
  cors({
    origin: ENV.CLIENT_URL,
    credentials: true,
  }),
);
// 32mb: receipt drafts parked in localStorage before scans were stored
// server-side can still carry a base64 image into the Add Expenses save, so the
// JSON body keeps generous headroom. New scans post the file to
// /ai/receipt-parse (multipart, 10MB multer cap) and only carry its URL.
app.use(express.json({ limit: "32mb" }));
app.use(express.urlencoded({ extended: true }));

// Scanned receipts are stored on disk (utils/receiptImage.js) and referenced by
// `expenses.image_url` as `/api/uploads/receipts/<file>`. Served without auth on
// purpose — the browser loads these from <img> tags and window.open, which can't
// send the Bearer token the rest of the API uses; file names are unguessable
// UUIDs and nothing is ever written here from a URL.
app.use(
  "/api/uploads",
  express.static(UPLOADS_ROOT, {
    index: false,
    dotfiles: "ignore",
    maxAge: "365d",
    immutable: true,
  }),
);

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
