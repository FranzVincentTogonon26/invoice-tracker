import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { pool } from "../config/db.js";

// __dirname doesn't exist in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "migrations");

(async () => {
  const client = await pool.connect();
  try {
    // Track which migrations have already been applied
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
          migration   TEXT PRIMARY KEY,
          applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const applied = new Set(
      (
        await client.query("SELECT migration FROM schema_migrations")
      ).rows.map((row) => row.migration),
    );

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No migration files found");
    }

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

      console.log(`Applying ${file}...`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (migration) VALUES ($1)",
          [file],
        );
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`${file}: ${err.message}`);
      }
    }

    console.log("Migrations up to date");
  } finally {
    client.release();
    await pool.end();
  }
})().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
});
