import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 3000),
  jellyfin: {
    baseUrl: process.env.JELLYFIN_BASE_URL ?? "",
    apiKey: process.env.JELLYFIN_API_KEY ?? ""
  }
};

export function assertConfig() {
  // You can keep this loose for now. Uncomment when ready to enforce.
  // if (!config.jellyfin.baseUrl) throw new Error("Missing JELLYFIN_BASE_URL");
  // if (!config.jellyfin.apiKey) throw new Error("Missing JELLYFIN_API_KEY");
}
