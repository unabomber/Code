export type Candidate = {
  itemId: string;
  title: string;
  year?: number;
  runtimeMinutes?: number;
  posterUrl?: string;
};

export async function fetchHealth() {
  const res = await fetch("/health");
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function fetchMovies(userId: string, limit = 10): Promise<Candidate[]> {
  const res = await fetch(`/api/jellyfin/movies?userId=${encodeURIComponent(userId)}&limit=${limit}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to fetch movies");
  return data.movies as Candidate[];
}

export type JellyfinUser = {
  id: string;
  name: string;
  isAdmin?: boolean;
};

export type JellyfinSession = {
  id: string;
  deviceName?: string;
  client?: string;
  userName?: string;
  isActive?: boolean;
  supportsRemoteControl?: boolean;
};

export async function fetchUsers(): Promise<JellyfinUser[]> {
  const res = await fetch("/api/jellyfin/users");
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to fetch users");
  return data.users as JellyfinUser[];
}

export async function fetchSessions(): Promise<JellyfinSession[]> {
  const res = await fetch("/api/jellyfin/sessions");
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to fetch sessions");
  return data.sessions as JellyfinSession[];
}

export async function playOnSession(sessionId: string, itemId: string): Promise<void> {
  const res = await fetch("/api/jellyfin/play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, itemId })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error ?? "Failed to start playback");
}
export type Room = {
  id: string;
  name: string;
  createdAt: string;
  closesAt: string;
  status: string;
};

export type Tally = Candidate & { votes: number };

export async function createRoom(name: string, minutesFromNow = 60): Promise<Room> {
  const res = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, minutesFromNow })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to create room");
  return data.room as Room;
}

export async function generateCandidates(
  roomId: string,
  userId: string,
  count = 12,
  libraryId?: string
): Promise<Candidate[]> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/candidates/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, count, libraryId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to generate candidates");
  return data.candidates as Candidate[];
}


export async function fetchRoom(roomId: string): Promise<Room> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to fetch room");
  return data.room as Room;
}

export async function fetchCandidates(roomId: string): Promise<Candidate[]> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/candidates`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to fetch candidates");
  return data.candidates as Candidate[];
}

export async function castVote(roomId: string, voterId: string, itemId: string): Promise<void> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voterId, itemId })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error ?? "Vote failed");
}

export async function fetchResults(roomId: string): Promise<{ room: Room; tallies: Tally[]; votes: { voterId: string; itemId: string }[] }> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/results`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to fetch results");
  return data;
}
export type JellyfinLibrary = { id: string; name: string };

export async function fetchLibraries(userId: string): Promise<JellyfinLibrary[]> {
  const res = await fetch(`/api/jellyfin/libraries?userId=${encodeURIComponent(userId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to fetch libraries");
  return data.libraries as JellyfinLibrary[];
}

export async function fetchWinner(roomId: string): Promise<{ room: Room; winner: Tally | null; tallies: Tally[] }> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/winner`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to fetch winner");
  return data;
}

export async function playWinner(roomId: string, sessionId: string): Promise<void> {
  const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/playWinner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error ?? "Failed to play winner");
}
