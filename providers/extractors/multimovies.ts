import { Stream } from "../types";

function isPlayable(url: string): boolean {
  return /\.(m3u8|mp4|mpd|webm|m4v)(\?|#|$)/i.test(url);
}

function collectMediaUrls(html: string, base: string): string[] {
  const out = new Set<string>();

  const jsonRe = /"(?:file|src|source|url|link|hls|dash|videoUrl|video_url|stream_url)"\s*:\s*"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = jsonRe.exec(html)) !== null) {
    try {
      const u = new URL(m[1], base).toString();
      if (isPlayable(u)) out.add(u);
    } catch {}
  }

  const directRe = /https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mp4|mpd|webm|m4v)(?:\?[^\s"'<>\\]*)?/gi;
  while ((m = directRe.exec(html)) !== null) {
    if (isPlayable(m[0])) out.add(m[0]);
  }

  return Array.from(out);
}

function collectIframes(html: string, base: string): string[] {
  const out = new Set<string>();
  const re = /<iframe[^>]+src\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try { out.add(new URL(m[1], base).toString()); } catch {}
  }
  return Array.from(out);
}

/* ---------- helper: normalise cookie header ---------- */
function extractCookies(setCookie: string[] | undefined): string {
  if (!setCookie || !Array.isArray(setCookie)) return "";
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

export async function multimoviesExtractor(
  embedUrl: string,
  signal: AbortSignal,
  axios: any,
  serverName: string,
  headers: Record<string, string>
): Promise<Stream[]> {
  const streams: Stream[] = [];

  try {
    /* 1. fetch the embed page and keep its cookies */
    const res = await axios.get(embedUrl, { headers, signal, timeout: 15000 });
    const html = String(res.data || "");
    const cookieHeader = extractCookies(res.headers?.["set-cookie"]);

    /* 2. collect any direct media URLs */
    for (const url of collectMediaUrls(html, embedUrl)) {
      streams.push({
        server: serverName,
        link: url,
        type: /\.m3u8/i.test(url) ? "m3u8" : /\.mpd/i.test(url) ? "mpd" : "mp4",
        headers: {
          Referer: embedUrl,
          Origin: new URL(embedUrl).origin,
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      });
    }

    /* 3. if nothing found, follow one level of iframes */
    if (streams.length === 0) {
      for (const iframeUrl of collectIframes(html, embedUrl).slice(0, 2)) {
        try {
          const inner = await axios.get(iframeUrl, { headers, signal, timeout: 12000 });
          const innerHtml = String(inner.data || "");
          const innerCookies = extractCookies(inner.headers?.["set-cookie"]);

          for (const url of collectMediaUrls(innerHtml, iframeUrl)) {
            streams.push({
              server: serverName,
              link: url,
              type: /\.m3u8/i.test(url) ? "m3u8" : /\.mpd/i.test(url) ? "mpd" : "mp4",
              headers: {
                Referer: iframeUrl,
                Origin: new URL(iframeUrl).origin,
                ...(innerCookies ? { Cookie: innerCookies } : {}),
              },
            });
          }
          if (streams.length > 0) break;
        } catch {}
      }
    }
  } catch {}

  return streams;
}
