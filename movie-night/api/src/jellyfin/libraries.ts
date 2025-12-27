import { config } from "../config";

type JellyfinView = {
  Id: string;
  Name: string;
  CollectionType?: string | null;
};

function ensureJellyfinConfigured() {
  if (!config.jellyfin.baseUrl || !config.jellyfin.apiKey) {
    throw new Error("Jellyfin not configured. Set JELLYFIN_BASE_URL and JELLYFIN_API_KEY.");
  }
}

async function jfFetch(path: string): Promise<any> {
  ensureJellyfinConfigured();
  const base = config.jellyfin.baseUrl.replace(/\/+$/, "");
  const url = `${base}${path}`;

  const res = await fetch(url, {
    headers: { "X-Emby-Token": config.jellyfin.apiKey }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyfin request failed: ${res.status} ${res.statusText} ${text}`);
  }

  return res.json();
}

export async function listMovieLibrariesForUser(userId: string) {
  // User-specific "views" (libraries) they can access
  const data = await jfFetch(`/Users/${encodeURIComponent(userId)}/Views`);
  const items: JellyfinView[] = data?.Items ?? [];

  // Keep only movie libraries (CollectionType === "movies")
  const libs = items
    .filter(v => (v.CollectionType ?? "").toLowerCase() === "movies")
    .map(v => ({ id: v.Id, name: v.Name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return libs;
}
