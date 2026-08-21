/* ---------------------------------------------------------------------------
   Database pool.

   This connects to a SHARED cPanel MySQL server: max_connections = 150 is the
   budget for every account on that box, not for us, and wait_timeout = 300s
   means the server hangs up on connections we leave idle. Both facts shape the
   settings below. Nothing here changes any server-side configuration -- every
   option is client-side, applied to our own connections only.
--------------------------------------------------------------------------- */
import mysql from 'mysql2/promise'
import { env } from './env.mjs'

/** Deliberately small. 8 of a 150-connection server-wide budget, shared with
 *  every other account on the host. Raise only with evidence of queueing. */
export const POOL_SIZE = 8

export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,

  /* --- shared-host courtesy --------------------------------------------- */
  connectionLimit: POOL_SIZE,
  maxIdle: 2,               // hold at most 2 idle sockets open between bursts
  idleTimeout: 60_000,      // recycle idle ones well inside the server's 300s wait_timeout
  enableKeepAlive: true,    // ...and keep the survivors from being silently dropped
  keepAliveInitialDelay: 10_000,
  waitForConnections: true, // queue rather than throw when all 8 are busy
  queueLimit: 0,
  connectTimeout: 10_000,

  /* --- correctness ------------------------------------------------------- */
  timezone: 'Z',            // driver reads/writes DATETIME as UTC. See src/time.mjs.
  charset: 'utf8mb4_general_ci',
  supportBigNumbers: true,
  /* BIGINT ids survive as strings rather than lossy doubles. The catch: this
   * also applies to COUNT(*) and to integer literals like SELECT 1 -- both come
   * back as strings, and '0' is truthy. Always Number() a numeric scalar read
   * back from a query before testing or comparing it. */
  bigNumberStrings: true,
  dateStrings: false,
  multipleStatements: false, // one statement per call — narrows injection blast radius
})

/** Run a query. Returns rows only. */
export async function query(sql, params) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

/** Run `fn` inside a transaction, releasing the connection either way. */
export async function transaction(fn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export const closePool = () => pool.end()
