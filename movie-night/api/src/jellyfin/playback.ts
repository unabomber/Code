import { config } from "../config";

function ensureJellyfinConfigured() {
  if (!config.jellyfin.baseUrl || !config.jellyfin.apiKey) {
    throw new Error("Jellyfin not configured. Set JELLYFIN_BASE_URL and JELLYFIN_API_KEY.");
  }
}

async function jfPostNoBody(pathWithQuery: string): Promise<void> {
  ensureJellyfinConfigured();
  const base = config.jellyfin.baseUrl.replace(/\/+$/, "");
  const url = `${base}${pathWithQuery}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Emby-Token": config.jellyfin.apiKey
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyfin request failed: ${res.status} ${res.statusText} ${text}`);
  }
}

export async function playOnSession(sessionId: string, itemId: string) {
  // playCommand + itemIds are query params (itemIds is comma-delimited)
  const qs = new URLSearchParams({
    playCommand: "PlayNow",
    itemIds: itemId,
    startPositionTicks: "0"
  });

  await jfPostNoBody(`/Sessions/${encodeURIComponent(sessionId)}/Playing?${qs.toString()}`);
}
