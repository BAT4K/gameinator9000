// src/config/db.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3, // keep this low for Railway free tier
  idleTimeoutMillis: 10000, // close idle clients after 10s
  connectionTimeoutMillis: 5000, // fail fast if cannot connect
});

export default pool;
