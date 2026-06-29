import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const sqlite3 = require("sqlite3");

sqlite3.verbose();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databaseDir = path.resolve(__dirname, "../database");
const dbPath = path.join(databaseDir, "communication_ltd_secure.db");

if (!fs.existsSync(databaseDir)) {
  fs.mkdirSync(databaseDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.log("Secure database connection error:", err.message);
  } else {
    console.log(`Secure database connected successfully: ${dbPath}`);
  }
});

db.serialize(() => {
  // Keep the secure build schema aligned with the existing controllers while
  // isolating its runtime data from the vulnerable demo database.
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");

  db.run(`
    CREATE TABLE IF NOT EXISTS sectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sector_name TEXT UNIQUE NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS internet_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_name TEXT UNIQUE NOT NULL,
      speed TEXT,
      price REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      package_id INTEGER,
      role TEXT NOT NULL DEFAULT 'viewer'
        CHECK (role IN ('admin', 'employee', 'viewer', 'customer')),
      failed_attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES internet_packages(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS password_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS subscription_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      package_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TEXT,
      reviewed_by INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (package_id) REFERENCES internet_packages(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      sector_id INTEGER,
      package_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sector_id) REFERENCES sectors(id),
      FOREIGN KEY (package_id) REFERENCES internet_packages(id)
    )
  `);

  db.run(`
    INSERT OR IGNORE INTO sectors (sector_name)
    VALUES
      ('Private'),
      ('Business'),
      ('Student'),
      ('Government')
  `);

  db.run(`
    INSERT OR IGNORE INTO internet_packages (package_name, speed, price)
    VALUES
      ('Basic Internet', '100MB', 79.90),
      ('Advanced Internet', '500MB', 119.90),
      ('Fiber Max', '1000MB', 149.90)
  `);

  db.run(
    "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer'",
    [],
    (alterErr) => {
      if (
        alterErr &&
        !alterErr.message.includes("duplicate column name: role")
      ) {
        console.log("Secure users role migration error:", alterErr.message);
      }
    },
  );

  db.run(
    "ALTER TABLE users ADD COLUMN package_id INTEGER",
    [],
    (alterErr) => {
      if (
        alterErr &&
        !alterErr.message.includes("duplicate column name: package_id")
      ) {
        console.log("Secure users package_id migration error:", alterErr.message);
      }
    },
  );

  db.run(
    `UPDATE users
       SET role = 'viewer'
       WHERE role IS NULL
          OR TRIM(role) = ''
          OR role NOT IN ('admin', 'employee', 'viewer', 'customer')`,
    [],
    (updateErr) => {
      if (updateErr) {
        console.log("Secure users role normalization error:", updateErr.message);
      }
    },
  );
});

export { dbPath };
export default db;
