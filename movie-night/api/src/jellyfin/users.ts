import { config } from "../config.js";

export type JellyfinUser = {
  Id: string;
  Name: string;
  HasPassword?: boolean;
  HasConfiguredPassword?: boolean;
  Policy?: {
    IsAdministrator?: boolean;
  };
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
    headers: {
      "X-Emby-Token": config.jellyfin.apiKey
    }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jellyfin request failed: ${res.status} ${res.statusText} ${text}`);
  }

  return res.json();
}

export async function listUsers(): Promise<Array<{ id: string; name: string; isAdmin?: boolean }>> {
  // Jellyfin exposes users at /Users
  const users = (await jfFetch("/Users")) as JellyfinUser[];

  return users
    .map((u) => ({
      id: u.Id,
      name: u.Name,
      isAdmin: u.Policy?.IsAdministrator
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
