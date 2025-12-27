import { config } from "../config.js";

type JellyfinMovie = {
  Id: string;
  Name: string;
  ProductionYear?: number;
  RunTimeTicks?: number;
};

export type Candidate = {
  itemId: string;
  title: string;
  year?: number;
  runtimeMinutes?: number;
  posterUrl?: string;
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

// MVP helper: get some movies (requires you to later provide a userId)
export async function getSomeMovies(userId: string, limit = 10, libraryId?: string): Promise<Candidate[]> {
  // Jellyfin endpoint commonly used to list items for a user
const params = new URLSearchParams({
  IncludeItemTypes: "Movie",
  Recursive: "true",
  Limit: String(limit),
  Fields: "PrimaryImageAspectRatio,ProductionYear,RunTimeTicks",
  SortBy: "Random"
});

if (libraryId) params.set("ParentId", libraryId);

const data = await jfFetch(`/Users/${encodeURIComponent(userId)}/Items?${params.toString()}`);

  const items: JellyfinMovie[] = data?.Items ?? [];
  const base = config.jellyfin.baseUrl.replace(/\/+$/, "");

  return items.map((m) => {
    const minutes =
      typeof m.RunTimeTicks === "number" ? Math.round(m.RunTimeTicks / 10_000_000 / 60) : undefined;

    return {
      itemId: m.Id,
      title: m.Name,
      year: m.ProductionYear,
      runtimeMinutes: minutes,
      posterUrl: `${base}/Items/${m.Id}/Images/Primary?maxHeight=360`
    };
  });
}
