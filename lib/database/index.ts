import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema"; // Ensure this path matches your file structure

// Use the POOLED connection string for your app logic
const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("POSTGRES_URL is not defined in environment variables");
}

// Create the Neon HTTP connection
const sql = neon(connectionString);

// Initialize Drizzle with the Neon HTTP driver
export const db = drizzle(sql, { schema });
