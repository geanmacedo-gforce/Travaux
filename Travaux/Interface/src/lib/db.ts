import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { config } from 'dotenv';

config({ override: true });

let pool: mysql.Pool;

function getDbConfig(): mysql.PoolOptions {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    try {
      const parsed = new URL(dbUrl);
      const dbNameFromPath = parsed.pathname.replace(/^\//, '');

      return {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : 3306,
        database: dbNameFromPath || process.env.DB_NAME || 'obras_db',
        user: decodeURIComponent(parsed.username || process.env.DB_USER || 'root'),
        password: decodeURIComponent(parsed.password || process.env.DB_PASSWORD || ''),
        waitForConnections: true,
        connectionLimit: parseInt(process.env.DB_POOL_MAX || '10', 10),
        queueLimit: 0,
        charset: 'utf8mb4',
        dateStrings: true,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      };
    } catch {
      // Fall through to individual DB_* vars when DATABASE_URL is malformed.
    }
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'obras_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_MAX || '10', 10),
    queueLimit: 0,
    charset: 'utf8mb4',
    dateStrings: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };
}

export async function initPool() {
  if (pool) return pool;

  pool = mysql.createPool(getDbConfig());

  return pool;
}

export async function getPool() {
  if (!pool) await initPool();
  return pool;
}

export async function query<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  values?: any[]
): Promise<[T[], any]> {
  const p = await getPool();
  return p.query<T[]>(sql, values);
}

export async function getOne<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  values?: any[]
): Promise<T | null> {
  const [rows] = await query<T>(sql, values);
  return rows.length > 0 ? rows[0] : null;
}

export async function getAll<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  values?: any[]
): Promise<T[]> {
  const [rows] = await query<T>(sql, values);
  return rows;
}

export async function execute(sql: string, values?: any[]) {
  const p = await getPool();
  return p.execute(sql, values);
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined as any;
  }
}
