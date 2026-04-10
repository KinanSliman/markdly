import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Change this from POSTGRES_URL to POSTGRES_URL_UNPOOLED
    url: process.env.POSTGRES_URL_UNPOOLED!,
  },
});
