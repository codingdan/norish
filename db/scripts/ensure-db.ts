/**
 * Ensures the database is ready before running migrations.
 * This script checks that the PostgreSQL database is accessible.
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function ensureDatabase() {
  const client = new pg.Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    await client.query("SELECT 1");
    console.log("Database connection verified");
  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

ensureDatabase();
