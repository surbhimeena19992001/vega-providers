import { ProviderContext, Stream } from "../types";
import { getJson, parseLink } from "./api";
import { throwProviderError } from "../providerErrors";

const NAME = "TG TV";

function isHttp(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

// The v2 endpoint is documented as returning HLS relay/playable URLs.
// Do not attempt to process encrypted DASH or extract/decrypt DRM keys.
export async function getStream({
  link,
  signal,
  providerContext,
}: {
  link: string;
  type: string;
  signal?: AbortSignal;
  providerContext: ProviderContext;
  isDownload?: boolean;
}): Promise<Stream[]> {
  const id = parseLink(link);
  try {
    const data = await getJson(
      providerContext,
      "/api/public/v2/channels/" + encodeURIComponent(id),
      signal,
    );
    const servers = Array.isArray(data?.servers) ? data.servers : [];
    const streams: Stream[] = [];
    const seen = new Set<string>();

    servers.forEach((server: any, index: number) => {
      const url = String(server?.playable ?? "").trim();
      if (!isHttp(url) || seen.has(url)) return;
      seen.add(url);
      const label = String(server?.label ?? "").trim() || "Server " + (index + 1);
      streams.push({
        server: NAME + " HLS - " + label,
        link: url,
        type: "m3u8",
        quality: "auto",
      });
    });

    return streams;
  } catch (error: any) {
    if (error?.response?.status === 404) return [];
    throwProviderError(NAME, "stream", error);
  }
}
