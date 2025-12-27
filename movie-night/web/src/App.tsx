import { useEffect, useMemo, useState } from "react";
import "./index.css";
import { fetchLibraries, type JellyfinLibrary } from "./api";
import {
  fetchHealth,
  fetchUsers,
  fetchSessions,
  fetchMovies,
  playOnSession,
  type Candidate,
  type JellyfinSession,
  type JellyfinUser,
  createRoom,
  generateCandidates,
  fetchRoom,
  fetchCandidates,
  castVote,
  fetchResults,
  fetchWinner,
  playWinner,
  type Room,
  type Tally
} from "./api";

function getHashRoomId() {
  // #room=abc123
  const h = window.location.hash ?? "";
  const m = h.match(/room=([a-z0-9]+)/i);
  return m?.[1] ?? "";
}

function setHashRoomId(id: string) {
  window.location.hash = `room=${id}`;
}

function getOrCreateVoterId(): string {
  const k = "movieNightVoterId";
  const existing = localStorage.getItem(k);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(k, id);
  return id;
}

export default function App() {
  const voterId = useMemo(() => getOrCreateVoterId(), []);

  const [health, setHealth] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Jellyfin (for candidate generation + remote play)
  const [users, setUsers] = useState<JellyfinUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [sessions, setSessions] = useState<JellyfinSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  // Room state
  const [roomId, setRoomId] = useState<string>(getHashRoomId());
  const [room, setRoom] = useState<Room | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [tallies, setTallies] = useState<Tally[]>([]);
  const [myVoteItemId, setMyVoteItemId] = useState<string>("");

  // Create room form
  const [newRoomName, setNewRoomName] = useState<string>("Friday Movie Night");


  const [libraries, setLibraries] = useState<JellyfinLibrary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>("");


  const [nowMs, setNowMs] = useState<number>(Date.now());
const [winner, setWinner] = useState<Tally | null>(null);


function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}


useEffect(() => {
  const t = window.setInterval(() => setNowMs(Date.now()), 1000);
  return () => window.clearInterval(t);
}, []);

  useEffect(() => {
  if (!selectedUserId) return;
  fetchLibraries(selectedUserId)
    .then((libs) => {
      setLibraries(libs);
      setSelectedLibraryId((prev) => (prev && libs.some(l => l.id === prev) ? prev : (libs[0]?.id ?? "")));
    })
    .catch((e) => setError(String(e?.message ?? e)));
}, [selectedUserId]);


  useEffect(() => {
    const onHash = () => setRoomId(getHashRoomId());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    fetchHealth().then(setHealth).catch((e) => setError(String(e?.message ?? e)));

    fetchUsers()
  .then(async (u) => {
    setUsers(u);
    const first = u[0]?.id ?? "";
    const uid = selectedUserId || first;
    if (uid) {
      setSelectedUserId(uid);
      const libs = await fetchLibraries(uid);
      setLibraries(libs);
      setSelectedLibraryId(libs[0]?.id ?? "");
    }
  })
  .catch((e) => setError(String(e?.message ?? e)));


    fetchSessions()
      .then(setSessions)
      .catch(() => {
        // ok if empty
      });
  }, []);

  async function loadRoomEverything(id: string) {
    setError(null);
    try {
      const r = await fetchRoom(id);
      setRoom(r);

      const c = await fetchCandidates(id);
      setCandidates(c);

      const res = await fetchResults(id);
      if (r.status === "closed") {
  try {
    const w = await fetchWinner(id);
    setWinner(w.winner);
    setTallies(w.tallies);
    setRoom(w.room);
  } catch {}
}
      setTallies(res.tallies);
      const mine = res.votes.find((v) => v.voterId === voterId)?.itemId ?? "";
      setMyVoteItemId(mine);
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setRoom(null);
      setCandidates([]);
      setTallies([]);
      setMyVoteItemId("");
    }
  }

  // When roomId changes, load state + start polling results
  useEffect(() => {
    if (!roomId) {
      setRoom(null);
      setCandidates([]);
      setTallies([]);
      setMyVoteItemId("");
      return;
    }

    loadRoomEverything(roomId);

    const t = window.setInterval(async () => {
      try {
        const res = await fetchResults(roomId);
        setRoom(res.room);
        setTallies(res.tallies);
        const mine = res.votes.find((v) => v.voterId === voterId)?.itemId ?? "";
        setMyVoteItemId(mine);
        // If closed, fetch winner reveal (once)
if (res.room?.status === "closed") {
  try {
    const w = await fetchWinner(roomId);
    setWinner(w.winner);
    setTallies(w.tallies);
    setRoom(w.room);
  } catch {
    // ignore
  }
} else {
  setWinner(null);
}
      } catch {
        // ignore transient polling errors
      }
    }, 2500);

    return () => window.clearInterval(t);
  }, [roomId, voterId]);

  async function onCreateRoom() {
    setError(null);
    try {
      const r = await createRoom(newRoomName.trim() || "Movie Night", roomMinutes);
      setHashRoomId(r.id);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function onGenerateCandidates() {
    if (!roomId) return;
    setError(null);
    try {
      if (!selectedUserId) throw new Error("Select a Jellyfin user to generate candidates");
      const c = await generateCandidates(roomId, selectedUserId, 12, selectedLibraryId || undefined);
      setCandidates(c);
      const res = await fetchResults(roomId);
      setTallies(res.tallies);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  async function onVote(itemId: string) {
    if (!roomId) return;
    setError(null);
    try {
      await castVote(roomId, voterId, itemId);
      setMyVoteItemId(itemId);
      const res = await fetchResults(roomId);
      setTallies(res.tallies);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  const leader = tallies.length ? tallies[0] : null;
  const closesAtMs = room ? Date.parse(room.closesAt) : NaN;
const remainingMs = Number.isFinite(closesAtMs) ? closesAtMs - nowMs : NaN;
const isClosed = room?.status === "closed" || (Number.isFinite(remainingMs) && remainingMs <= 0);
const [roomMinutes, setRoomMinutes] = useState<number>(1);
  const maxVotes = Math.max(1, ...tallies.map(t => t.votes ?? 0));
  return (
    <div className="container">
      <h1 className="h1">Movie Night</h1>

      <div className="panel">
        <div><b>API health:</b> {health ? "OK" : "…"}</div>
        {health && <div style={{ fontSize: "12px", opacity: 0.7 }}>{health.time}</div>}
        <div style={{ fontSize: "12px", opacity: 0.7 }}>Your voterId: {voterId}</div>
      </div>

      {error && (
        <div className="panel">
          <p style={{ color: "crimson", margin: 0 }}>{error}</p>
        </div>
      )}

      {!roomId && (
        <div className="panel">
          <h2>Create a room</h2>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <input className="input"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Room name"
              style={{ width: "320px" }}
            />
            <select value={roomMinutes} onChange={(e) => setRoomMinutes(Number(e.target.value))}>
  <option value={1}>1 minute (test)</option>
  <option value={5}>5 minutes</option>
  <option value={15}>15 minutes</option>
  <option value={60}>60 minutes</option>
</select>
            <button className="btn" onClick={onCreateRoom}>Create</button>
          </div>
          <p style={{ fontSize: "12px", opacity: 0.7 }}>
            After creating, share the URL with friends. Everyone votes once (you can change your vote).
          </p>
        </div>
        
      )}

      {isClosed && (
  <div className="panel reveal">
    <div className="winnerHeadline">And the winner is…</div>

    {winner ? (
      <>
        <h3 className="winnerName">{winner.title}</h3>
        <div className="winnerMeta">
          <span className="pill">{winner.year ?? "—"}</span>
          <span className="pill">{winner.runtimeMinutes ? `${winner.runtimeMinutes} min` : "—"}</span>
          <span className="pill">{winner.votes ?? 0} vote{(winner.votes ?? 0) === 1 ? "" : "s"}</span>
        </div>

        <div className="spacer" />

        <div className="row">
          <button
            className="btn btnPrimary"
            disabled={!selectedSessionId}
            onClick={async () => {
              try {
                setError(null);
                if (!selectedSessionId) return;
                await playWinner(roomId, selectedSessionId);
              } catch (e: any) {
                setError(String(e?.message ?? e));
              }
            }}
            title={!selectedSessionId ? "Select a session first" : "Play the winner"}
          >
            Play winner on selected session
          </button>

          <button
            className="btn"
            onClick={async () => {
              try {
                const w = await fetchWinner(roomId);
                setWinner(w.winner);
                setTallies(w.tallies);
                setRoom(w.room);
              } catch (e: any) {
                setError(String(e?.message ?? e));
              }
            }}
          >
            Refresh winner
          </button>
        </div>
      </>
    ) : (
      <div className="subtle">Calculating winner…</div>
    )}
  </div>
)}


      {roomId && (
        <>
          <div className="panel">
            <h2>
              Room: <span style={{ fontWeight: 700 }}>{room?.name ?? roomId}</span>
            </h2>
            {room?.libraryId ? (
  <div style={{ fontSize: "12px", opacity: 0.7 }}>
    Library: <b>{room.libraryName ?? "(unknown)"}</b> · <span>{room.libraryId}</span>
  </div>
) : (
  <div style={{ fontSize: "12px", opacity: 0.7 }}>
    Library: (not set yet — generate candidates to lock one in)
  </div>
)}
            {room && (
              <div style={{ fontSize: "12px", opacity: 0.7 }}>
                Closes at: {new Date(room.closesAt).toLocaleString()}
              </div>
            )}
            <div className="countdownRow">
  <span className="statePill">
    <span className={`stateDot ${isClosed ? "stateDotClosed" : ""}`} />
    {isClosed ? "Voting closed" : "Voting open"}
  </span>

  {!isClosed && Number.isFinite(remainingMs) && (
    <div>
      <span className="subtle">Closes in </span>
      <span className="countdown">{formatCountdown(remainingMs)}</span>
    </div>
  )}

  {isClosed && (
    <div className="subtle">Closed at {room ? new Date(room.closesAt).toLocaleString() : ""}</div>
  )}
</div>

            <div style={{ fontSize: "12px", opacity: 0.7 }}>
              Share link: {window.location.href}
            </div>

            <hr style={{ margin: "12px 0" }} />

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <label>
                Jellyfin user (for candidate generation):&nbsp;
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  style={{ minWidth: "220px" }}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}{u.isAdmin ? " (admin)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label>
  Movie library:&nbsp;
  <select
    value={selectedLibraryId}
    onChange={(e) => setSelectedLibraryId(e.target.value)}
    style={{ minWidth: "220px" }}
    disabled={!libraries.length}
  >
    {!libraries.length && <option value="">(no movie libraries)</option>}
    {libraries.map((l) => (
      <option key={l.id} value={l.id}>
        {l.name}
      </option>
    ))}
  </select>
</label>


              <button className="btn" onClick={onGenerateCandidates} disabled={!selectedUserId}>
                Generate candidates
              </button>

              <button className="btn"
                onClick={async () => setSessions(await fetchSessions())}
                type="button"
              >
                Refresh sessions
              </button>

              <label>
                Session (for playback later):&nbsp;
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  style={{ minWidth: "280px" }}
                >
                  <option value="">— none —</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {(s.deviceName ?? "Unknown device")} · {(s.client ?? "Unknown client")}
                      {s.userName ? ` · ${s.userName}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {leader && (
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>Current leader</h3>
              <b>{leader.title}</b> — {leader.votes} vote{leader.votes === 1 ? "" : "s"}
              <div style={{ marginTop: "8px" }}>
                <button className="btn"
                  disabled={!selectedSessionId}
                  onClick={async () => {
                    try {
                      setError(null);
                      if (!selectedSessionId) return;
                      await playOnSession(selectedSessionId, leader.itemId);
                    } catch (e: any) {
                      setError(String(e?.message ?? e));
                    }
                  }}
                >
                  Play leader on selected session
                </button>
              </div>
              <div style={{ fontSize: "12px", opacity: 0.7, marginTop: "6px" }}>
                (Later we’ll switch this to “Play winner” when the room closes.)
              </div>
            </div>
          )}

          <div className="panel">
            <h2 style={{ marginTop: 0 }}>Candidates</h2>
            {!candidates.length && (
              <p style={{ opacity: 0.7 }}>
                No candidates yet. Click <b>Generate candidates</b>.
              </p>
            )}

            <div className="grid">
  {tallies.map((m, idx) => {
    const isMine = myVoteItemId === m.itemId;
    const isLeader = idx === 0 && (m.votes ?? 0) > 0;
    const leaderLabel = isClosed ? "Winner" : "Leading";
    const pct = Math.round(((m.votes ?? 0) / maxVotes) * 100);

    return (
      <div key={m.itemId} className="movieCard">
        {isLeader && <div className="badgeLeader">{leaderLabel}</div>}
        {isMine && <div className="badgeVoted">Your vote</div>}

        {m.posterUrl && <img className="poster" src={m.posterUrl} alt={m.title} />}

        <div className="cardBody">
          <div className="titleRow">
            <div style={{ minWidth: 0 }}>
              <div className="movieTitle">{m.title}</div>
              <div className="meta">
                <span className="pill">{m.year ?? "—"}</span>
                <span className="pill">{m.runtimeMinutes ? `${m.runtimeMinutes} min` : "—"}</span>
                <span className="pill">{m.votes ?? 0} vote{(m.votes ?? 0) === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>

          <div className="voteBarWrap" aria-label="Vote bar">
            <div className="voteBar" style={{ width: `${pct}%` }} />
          </div>

          <div className="actions">
            <button 
              className={`btn ${isMine ? "btnPrimary" : ""}`}
              onClick={() => onVote(m.itemId)}
            >
              {isMine ? "Voted ✓" : "Vote"}
            </button>

            <button
              className="btn"
              disabled={!selectedSessionId}
              onClick={async () => {
                try {
                  setError(null);
                  if (!selectedSessionId) return;
                  await playOnSession(selectedSessionId, m.itemId);
                } catch (e: any) {
                  setError(String(e?.message ?? e));
                }
              }}
              title={!selectedSessionId ? "Select a session first" : "Play on selected session"}
            >
              Play
            </button>
          </div>

          <div className="mini">{m.itemId}</div>
        </div>
      </div>
    );
  })}
</div>
          </div>
        </>
      )}
    </div>
  );
}
