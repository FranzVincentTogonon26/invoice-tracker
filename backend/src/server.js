import app from "./app.js";
import { ENV } from "./config/env.js";
import { pool } from "./config/db.js";

// Neon (free tier) suspends compute after a few idle minutes, and the first
// query after that pays a cold-start handshake (often 5–30s) — longer than a
// page-load burst will wait, which surfaced as `pg-pool timeout exceeded`
// inside parallel endpoints like budgetInfo. Ping at boot so the wake happens
// here, once, with visible timing — instead of mid-burst on a user request.
// Retries until the database answers; the API still listens meanwhile.
const warmupDatabase = async (attempts = 12, delayMs = 5000) => {
  const started = Date.now();
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      const wokeIn = ((Date.now() - started) / 1000).toFixed(1);
      console.log(
        `✅ Database ready (woke in ~${wokeIn}s after ${attempt} attempt${attempt === 1 ? "" : "s"})`,
      );
      return;
    } catch (err) {
      console.warn(
        `⏳ Database warmup attempt ${attempt}/${attempts} failed: ${err?.message ?? err}`,
      );
      if (attempt < attempts)
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  console.error(
    "❌ Database warmup exhausted — the API is up but queries will fail until the database is reachable. Check Neon's compute status (Active vs Suspended) and DATABASE_URL.",
  );
};

app.listen(ENV.PORT, () => {
  console.log(`🌐 API listening on port: ${ENV.PORT}`);
  void warmupDatabase();
});
