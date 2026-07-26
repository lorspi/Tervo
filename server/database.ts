import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'data', 'tervo.db');

let db: Database;

export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs();

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'vendedor',
      password TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      stock INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      document TEXT,
      phone TEXT,
      email TEXT,
      address TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      commission_percent REAL NOT NULL DEFAULT 0,
      flat_fee REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      date TEXT NOT NULL,
      client_id TEXT,
      client_name TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      total_commissions REAL NOT NULL DEFAULT 0,
      total_fees REAL NOT NULL DEFAULT 0,
      total_payable REAL NOT NULL DEFAULT 0,
      cashier_id TEXT NOT NULL,
      cashier_name TEXT NOT NULL,
      cash_session_id TEXT NOT NULL,
      terminal_id TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sale_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id TEXT NOT NULL,
      method_id TEXT NOT NULL,
      method_name TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cash_sessions (
      id TEXT PRIMARY KEY,
      open_date TEXT NOT NULL,
      close_date TEXT,
      opened_by TEXT NOT NULL,
      opened_by_name TEXT NOT NULL,
      closed_by TEXT,
      closed_by_name TEXT,
      initial_cash REAL NOT NULL DEFAULT 0,
      expected_amounts TEXT NOT NULL DEFAULT '{}',
      real_amounts TEXT,
      discrepancies TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      terminal_id TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      action_type TEXT NOT NULL,
      details TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS active_sessions (
      user_id TEXT PRIMARY KEY,
      terminal_id TEXT NOT NULL,
      login_time TEXT NOT NULL,
      last_heartbeat TEXT NOT NULL
    )
  `);

  // Seed default data if empty
  const userCount = db.exec("SELECT COUNT(*) as count FROM users");
  if (userCount[0]?.values[0][0] === 0) {
    await seedDefaultData();
  }

  persistDatabase();
  return db;
}

function seedDefaultData() {
  // Default users
  db.run(`INSERT INTO users (id, username, name, role, password, active) VALUES (?, ?, ?, ?, ?, ?)`,
    ['u1', 'admin', 'Administrador', 'admin', '123', 1]);
  db.run(`INSERT INTO users (id, username, name, role, password, active) VALUES (?, ?, ?, ?, ?, ?)`,
    ['u2', 'vendedor', 'Vendedor', 'vendedor', '123', 1]);

  // Default payment methods
  db.run(`INSERT INTO payment_methods (id, name, commission_percent, flat_fee, active) VALUES (?, ?, ?, ?, ?)`,
    ['pm1', 'Efectivo', 0, 0, 1]);
  db.run(`INSERT INTO payment_methods (id, name, commission_percent, flat_fee, active) VALUES (?, ?, ?, ?, ?)`,
    ['pm2', 'Tarjeta', 2.5, 50, 1]);
  db.run(`INSERT INTO payment_methods (id, name, commission_percent, flat_fee, active) VALUES (?, ?, ?, ?, ?)`,
    ['pm3', 'Transferencia', 0, 0, 1]);

  // Default config
  db.run(`INSERT INTO config (key, value) VALUES (?, ?)`, ['storeName', 'Mi Tienda POS']);
  db.run(`INSERT INTO config (key, value) VALUES (?, ?)`, ['storeInfo', 'Dirección de tu tienda\nTeléfono: +56 9 0000 0000\nBoleta de Venta']);
  db.run(`INSERT INTO config (key, value) VALUES (?, ?)`, ['lowStockAlert', '5']);
}

export function persistDatabase() {
  schedulePersist();
}

// Debounced disk persistence - groups rapid writes into a single flush
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DELAY_MS = 500; // Write to disk at most every 500ms

function schedulePersist() {
  if (persistTimer) return; // already scheduled
  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushToFile();
  }, PERSIST_DELAY_MS);
}

function flushToFile() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    // Write to temp file first, then rename (atomic on most filesystems)
    const tmpPath = DB_PATH + '.tmp';
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, DB_PATH);
  } catch (err) {
    console.error('Error persisting database to disk:', err);
  }
}

// Force immediate persist (for shutdown scenarios)
export function forcePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  flushToFile();
}

// Run a set of operations inside a SQLite transaction (atomic)
export function withTransaction(fn: () => void): void {
  db.run('BEGIN TRANSACTION');
  try {
    fn();
    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

export function getDb(): Database {
  return db;
}

// Ensure data is flushed before process exits
process.on('SIGINT', () => { forcePersist(); process.exit(0); });
process.on('SIGTERM', () => { forcePersist(); process.exit(0); });
process.on('exit', () => { forcePersist(); });
