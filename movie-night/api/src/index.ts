import express from "express";
import cors from "cors";
import { config, assertConfig } from "./config";
import { healthRouter } from "./routes/health";
import { getSomeMovies } from "./jellyfin/client";
import { listUsers } from "./jellyfin/users";
import { listSessions } from "./jellyfin/sessions";
import { playOnSession } from "./jellyfin/playback";
import { migrate } from "./db/db";
import { roomsRouter } from "./routes/rooms";
import { winnerRouter } from "./routes/winner";
import { listMovieLibrariesForUser } from "./jellyfin/libraries";

assertConfig();

const app = express();
app.use(cors());
app.use(express.json());

app.use(healthRouter);
app.use(roomsRouter);
app.use(winnerRouter);

app.get("/api/config", (_req, res) => {
  res.json({
    jellyfin: {
      baseUrlSet: Boolean(process.env.JELLYFIN_BASE_URL),
      apiKeySet: Boolean(process.env.JELLYFIN_API_KEY)
    }
  });
});
app.post("/api/jellyfin/play", async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId ?? "");
    const itemId = String(req.body?.itemId ?? "");

    if (!sessionId) return res.status(400).json({ error: "Missing sessionId" });
    if (!itemId) return res.status(400).json({ error: "Missing itemId" });

    await playOnSession(sessionId, itemId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});
app.get("/api/jellyfin/libraries", async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "").trim();
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const libraries = await listMovieLibrariesForUser(userId);
    res.json({ libraries });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});

app.get("/api/jellyfin/users", async (_req, res) => {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});
app.get("/api/jellyfin/sessions", async (_req, res) => {
  try {
    const sessions = await listSessions();
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});
// Tiny Jellyfin smoke test endpoint (you'll replace this with room/candidates later)
app.get("/api/jellyfin/movies", async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "");
    if (!userId) return res.status(400).json({ error: "Missing userId query param" });

    const limit = Number(req.query.limit ?? 10);
    const movies = await getSomeMovies(userId, Number.isFinite(limit) ? limit : 10);
    res.json({ movies });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});
migrate();

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
