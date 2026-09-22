import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { pool } from "../config/db.js";

// __dirname doesn't exist in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

    console.log("Applying schema...");
    await pool.query(sql);

    console.log("Schema applied successfully");
  } catch (err) {
    console.error("Error applying schema:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();



