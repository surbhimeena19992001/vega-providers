import { Stream, ProviderContext } from "../types";
import { findIframeUrls, resolveEmbedHtml } from "./shared";

export async function iqstExtractor(
  url: string, signal: AbortSignal, axios: any, _cheerio: any,
  headers: Record<string, string>, _ctx: ProviderContext
): Promise<Stream[]> {
  try {
    const res = await axios.get(url, { headers, signal, timeout: 18000 });
    const html = String(res.data || "");
    const direct = await resolveEmbedHtml(html, url, "IQST");
    if (direct.length) return direct;
    for (const iframe of findIframeUrls(html, url).slice(0, 3)) {
      try {
        const inner = await axios.get(iframe, { headers, signal, timeout: 15000 });
        const s = await resolveEmbedHtml(String(inner.data || ""), iframe, "IQST");
        if (s.length) return s;
      } catch {}
    }
  } catch {}
  return [];
}
