import dotenv from "dotenv";
dotenv.config({ quiet: true });

export const ENV = {
  PORT: process.env.PORT || 8000,
  NODE_ENV: process.env.NODE_ENV || "development",
  CLIENT_URL: process.env.CLIENT_URL,
  JWT_EXPIRES: process.env.JWT_EXPIRES || "7d",
  JWT_SECRET: process.env.JWT_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM || "Invoice Tracker <onboarding@resend.dev>",
};

// Fail fast with a clear message instead of failing obscurely at request time
const REQUIRED_ENV_KEYS = ["JWT_SECRET", "DATABASE_URL", "CLIENT_URL", "RESEND_API_KEY"];

for (const key of REQUIRED_ENV_KEYS) {
  if (!ENV[key]) {
    throw new Error(
      `Missing required environment variable: ${key}. Check backend/.env`,
    );
  }
}
