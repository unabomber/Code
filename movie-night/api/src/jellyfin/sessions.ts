import { config } from "../config";

type JellyfinSessionRaw = {
  Id?: string;
  DeviceName?: string;
  Client?: string;
  UserName?: string;
  NowPlayingItem?: { Id?: string; Name?: string } | null;
  PlayState?: { IsPaused?: boolean } | null;
  SupportsRemoteControl?: boolean;
  IsActive?: boolean;
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

export async function listSessions() {
  // Typical Jellyfin endpoint
  const raw = (await jfFetch("/Sessions")) as JellyfinSessionRaw[];

  // Filter to sessions that can be controlled remotely (usually what you want)
  const sessions = raw
    .filter((s) => s.Id)
    .map((s) => ({
      id: s.Id as string,
      deviceName: s.DeviceName,
      client: s.Client,
      userName: s.UserName,
      isActive: s.IsActive,
      supportsRemoteControl: s.SupportsRemoteControl,
      nowPlaying: s.NowPlayingItem?.Name ?? null,
      isPaused: s.PlayState?.IsPaused ?? null
    }))
    .sort((a, b) => (a.deviceName ?? "").localeCompare(b.deviceName ?? ""));

  return sessions;
}
