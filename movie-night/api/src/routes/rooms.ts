import { Router } from "express";
import { db } from "../db/db";
import { newId, nowIso } from "../util/id";
import { getSomeMovies } from "../jellyfin/client";

export const roomsRouter = Router();




function maybeCloseRoom(roomId: string) {
  const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(roomId) as any;
  if (!room) return null;

  const closes = Date.parse(room.closesAt);
  const shouldClose = Number.isFinite(closes) && Date.now() > closes;

  if (shouldClose && room.status !== "closed") {
    db.prepare(`UPDATE rooms SET status='closed' WHERE id=?`).run(roomId);
    return { ...room, status: "closed" };
  }

  return room;
}


/**
 * POST /api/rooms
 * body: { name: string, closesAt?: string, minutesFromNow?: number }
 */
roomsRouter.post("/api/rooms", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) return res.status(400).json({ error: "Missing name" });

  const createdAt = nowIso();
  const minutesFromNow = Number(req.body?.minutesFromNow ?? 60);
  const closesAt =
    String(req.body?.closesAt ?? "").trim() ||
    new Date(Date.now() + Math.max(1, minutesFromNow) * 60_000).toISOString();

  const id = newId(10);

  db.prepare(
    `INSERT INTO rooms (id, name, createdAt, closesAt, status)
     VALUES (?, ?, ?, ?, 'open')`
  ).run(id, name, createdAt, closesAt);

  res.json({ room: { id, name, createdAt, closesAt, status: "open" } });
});

/**
 * GET /api/rooms/:id
 */
roomsRouter.get("/api/rooms/:id", (req, res) => {
  const id = String(req.params.id);
  const room = maybeCloseRoom(id);
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({ room });
});

/**
 * POST /api/rooms/:id/candidates/generate
 * body: { userId: string, count?: number }
 *
 * Locks in candidates for a room by pulling random movies from Jellyfin.
 */
roomsRouter.post("/api/rooms/:id/candidates/generate", async (req, res) => {
  const roomId = String(req.params.id);
  const libraryId = String(req.body?.libraryId ?? "").trim() || undefined;
  const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });

  if (room.status !== "open") return res.status(400).json({ error: "Room is not open" });

  const userId = String(req.body?.userId ?? "").trim();
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const count = Math.max(5, Math.min(40, Number(req.body?.count ?? 12)));

  let libraryName: string | null = null;

if (libraryId) {
  // fetch the user's movie libraries and match by id
  // (reuse your existing Jellyfin helper)
  const { listMovieLibrariesForUser } = await import("../jellyfin/libraries");
  const libs = await listMovieLibrariesForUser(userId);
  const match = libs.find(l => l.id === libraryId);
  libraryName = match?.name ?? null;

  // store selection on the room
  db.prepare(`UPDATE rooms SET libraryId=?, libraryName=? WHERE id=?`)
    .run(libraryId, libraryName, roomId);
}


  const movies = await getSomeMovies(userId, count, libraryId ?? undefined);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO candidates
      (id, roomId, itemId, title, year, runtimeMinutes, posterUrl, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const createdAt = nowIso();
  const tx = db.transaction(() => {
    for (const m of movies) {
      insert.run(
        newId(12),
        roomId,
        m.itemId,
        m.title,
        m.year ?? null,
        m.runtimeMinutes ?? null,
        m.posterUrl ?? null,
        createdAt
      );
    }
  });
  tx();

  const candidates = db
    .prepare(`SELECT itemId, title, year, runtimeMinutes, posterUrl FROM candidates WHERE roomId = ?`)
    .all(roomId);

  res.json({ candidates });
});

/**
 * GET /api/rooms/:id/candidates
 */
roomsRouter.get("/api/rooms/:id/candidates", (req, res) => {
  const roomId = String(req.params.id);
  const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const candidates = db
    .prepare(`SELECT itemId, title, year, runtimeMinutes, posterUrl FROM candidates WHERE roomId = ?`)
    .all(roomId);

  res.json({ candidates });
});

/**
 * POST /api/rooms/:id/votes
 * body: { voterId: string, itemId: string }
 *
 * One vote per voter per room. New vote overwrites old vote (upsert).
 */
roomsRouter.post("/api/rooms/:id/votes", (req, res) => {
  const roomId = String(req.params.id);
  const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const now = Date.now();
  const closes = Date.parse(room.closesAt);
  if (Number.isFinite(closes) && now > closes) {
    // Auto-close
    db.prepare(`UPDATE rooms SET status='closed' WHERE id=?`).run(roomId);
    return res.status(400).json({ error: "Voting is closed" });
  }

  const voterId = String(req.body?.voterId ?? "").trim();
  const itemId = String(req.body?.itemId ?? "").trim();
  if (!voterId) return res.status(400).json({ error: "Missing voterId" });
  if (!itemId) return res.status(400).json({ error: "Missing itemId" });

  const exists = db
    .prepare(`SELECT 1 FROM candidates WHERE roomId = ? AND itemId = ?`)
    .get(roomId, itemId);
  if (!exists) return res.status(400).json({ error: "Item is not a candidate in this room" });

  db.prepare(
    `INSERT INTO votes (roomId, voterId, itemId, createdAt)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(roomId, voterId) DO UPDATE SET itemId=excluded.itemId, createdAt=excluded.createdAt`
  ).run(roomId, voterId, itemId, nowIso());

  res.json({ ok: true });
});

/**
 * GET /api/rooms/:id/results
 * returns tallies and (if available) each voter's current vote
 */
roomsRouter.get("/api/rooms/:id/results", (req, res) => {
  const roomId = String(req.params.id);
  const room = maybeCloseRoom(roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (room.status === "closed") return res.status(400).json({ error: "Voting is closed" });
  const tallies = db
    .prepare(
      `
      SELECT c.itemId, c.title, c.year, c.runtimeMinutes, c.posterUrl,
             COUNT(v.itemId) AS votes
      FROM candidates c
      LEFT JOIN votes v
        ON v.roomId = c.roomId AND v.itemId = c.itemId
      WHERE c.roomId = ?
      GROUP BY c.itemId
      ORDER BY votes DESC, c.title ASC
      `
    )
    .all(roomId);

  const votes = db
    .prepare(`SELECT voterId, itemId FROM votes WHERE roomId = ?`)
    .all(roomId);

  res.json({ room, tallies, votes });
});
