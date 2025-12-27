import { Router } from "express";
import { db } from "../db/db";
import { playOnSession } from "../jellyfin/playback";
import { nowIso } from "../util/id";

export const winnerRouter = Router();

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

function getTallies(roomId: string) {
  return db
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
    .all(roomId) as Array<any>;
}

function pickWinner(tallies: Array<any>) {
  // Plurality winner: highest votes. Tie-break: alphabetical title (deterministic).
  // (If you prefer “host breaks ties” or random tie-break, we can change this.)
  return tallies.length ? tallies[0] : null;
}

/**
 * GET /api/rooms/:id/winner
 * Returns winner if room is closed (or auto-closes if past closesAt).
 */
winnerRouter.get("/api/rooms/:id/winner", (req, res) => {
  const roomId = String(req.params.id);
  const room = maybeCloseRoom(roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });

  const tallies = getTallies(roomId);
  const winner = pickWinner(tallies);

  res.json({
    room,
    winner: room.status === "closed" ? winner : null,
    tallies
  });
});

/**
 * POST /api/rooms/:id/playWinner
 * body: { sessionId: string }
 *
 * Auto-closes room if needed, computes winner, plays it, stores playedItemId/playedAt.
 */
winnerRouter.post("/api/rooms/:id/playWinner", async (req, res) => {
  try {
    const roomId = String(req.params.id);
    const sessionId = String(req.body?.sessionId ?? "").trim();
    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });

    const room = maybeCloseRoom(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });

    // If already played, just replay (or return it). I’m choosing “return existing” for safety.
    if (room.playedItemId) {
      return res.json({
        ok: true,
        room,
        winner: { itemId: room.playedItemId },
        alreadyPlayed: true
      });
    }

    if (room.status !== "closed") {
      return res.status(400).json({ error: "Room is still open. Wait for close time or close it first." });
    }

    const tallies = getTallies(roomId);
    const winner = pickWinner(tallies);
    if (!winner) return res.status(400).json({ error: "No candidates/winner available" });

    await playOnSession(sessionId, winner.itemId);

    db.prepare(`UPDATE rooms SET playedItemId=?, playedAt=? WHERE id=?`)
      .run(winner.itemId, nowIso(), roomId);

    const updated = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(roomId);

    res.json({ ok: true, room: updated, winner });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});

/**
 * POST /api/rooms/:id/close
 * Optional admin/manual close (useful for testing).
 */
winnerRouter.post("/api/rooms/:id/close", (req, res) => {
  const roomId = String(req.params.id);
  const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(roomId);
  if (!room) return res.status(404).json({ error: "Room not found" });

  db.prepare(`UPDATE rooms SET status='closed' WHERE id=?`).run(roomId);
  const updated = db.prepare(`SELECT * FROM rooms WHERE id=?`).get(roomId);
  res.json({ room: updated });
});
