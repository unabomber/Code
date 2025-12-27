import Database from "better-sqlite3";
import path from "node:path";

const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "data.sqlite");
export const db = new Database(dbPath);

// Speed + safety for a single-file DB
db.pragma("journal_mode = WAL");

function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl};`);
  }
}

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      closesAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open'
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      itemId TEXT NOT NULL,
      title TEXT NOT NULL,
      year INTEGER,
      runtimeMinutes INTEGER,
      posterUrl TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(roomId) REFERENCES rooms(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_room_item
      ON candidates(roomId, itemId);

    CREATE TABLE IF NOT EXISTS votes (
      roomId TEXT NOT NULL,
      voterId TEXT NOT NULL,
      itemId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      PRIMARY KEY(roomId, voterId),
      FOREIGN KEY(roomId) REFERENCES rooms(id)
    );

    CREATE INDEX IF NOT EXISTS idx_votes_room_item
      ON votes(roomId, itemId);
  `);

  ensureColumn("rooms", "playedItemId", "playedItemId TEXT");
  ensureColumn("rooms", "playedAt", "playedAt TEXT");
  ensureColumn("rooms", "libraryId", "libraryId TEXT");
  ensureColumn("rooms", "libraryName", "libraryName TEXT");
}
