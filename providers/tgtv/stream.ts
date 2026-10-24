import { ProviderContext, Stream } from "../types";
import { getJson, parseLink } from "./api";
import { throwProviderError } from "../providerErrors";

const NAME = "TG TV";

export async function getStream({ link, signal, providerContext }: {
  link: string; type?: string; signal?: AbortSignal; providerContext: ProviderContext; isDownload?: boolean;
}): Promise<Stream[]> {
  const id = parseLink(link);
  try {
    const data = await getJson(providerContext, "/api/public/v2/channels/" + encodeURIComponent(id), signal);
    const servers = Array.isArray(data?.servers) ? data.servers : [];
    const streams: Stream[] = [];
    servers.forEach((server: any, index: number) => {
      const url = String(server?.playable ?? "");
      // This provider intentionally supports only direct HTTP(S) HLS links.
      if (!/^https?:\/\//i.test(url) || !/\.m3u8(?:[?#]|$)/i.test(url)) return;
      streams.push({
        server: NAME + " HLS - " + (String(server?.label ?? "").trim() || "Server " + (index + 1)),
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
