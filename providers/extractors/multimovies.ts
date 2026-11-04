import { Stream } from "../types";

function isPlayable(url: string): boolean {
  return /\.(m3u8|mp4|mpd|webm|m4v)(\?|#|$)/i.test(url);
}

function b64decode(input: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let s = String(input || "").replace(/[^A-Za-z0-9+/=]/g, "");
  let out = "";
  let i = 0;
  while (i < s.length) {
    const e1 = chars.indexOf(s.charAt(i++));
    const e2 = chars.indexOf(s.charAt(i++));
    const e3 = chars.indexOf(s.charAt(i++));
    const e4 = chars.indexOf(s.charAt(i++));
    if (e1 < 0 || e2 < 0) break;
    out += String.fromCharCode((e1 << 2) | (e2 >> 4));
    if (e3 !== 64 && e3 >= 0) out += String.fromCharCode(((e2 & 15) << 4) | (e3 >> 2));
    if (e4 !== 64 && e4 >= 0) out += String.fromCharCode(((e3 & 3) << 6) | e4);
  }
  return out;
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

  const b64Re = /(?:atob\s*\(\s*["']|["'])([A-Za-z0-9+/=]{40,})(?:["']\s*\)|["'])/g;
  while ((m = b64Re.exec(html)) !== null) {
    try {
      const decoded = b64decode(m[1]);
      if (isPlayable(decoded)) {
        try { out.add(new URL(decoded, base).toString()); }
        catch { out.add(decoded); }
      }
    } catch {}
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

export async function multimoviesExtractor(
  embedUrl: string,
  signal: AbortSignal,
  axios: any,
  serverName: string,
  headers: Record<string, string>
): Promise<Stream[]> {
  const streams: Stream[] = [];

  try {
    const res = await axios.get(embedUrl, { headers, signal, timeout: 15000 });
    const html = String(res.data || "");

    for (const url of collectMediaUrls(html, embedUrl)) {
      streams.push({
        server: serverName,
        link: url,
        type: /\.m3u8/i.test(url) ? "m3u8" : /\.mpd/i.test(url) ? "mpd" : "mp4",
      });
    }

    if (streams.length === 0) {
      for (const iframeUrl of collectIframes(html, embedUrl).slice(0, 2)) {
        try {
          const inner = await axios.get(iframeUrl, { headers, signal, timeout: 12000 });
          const innerHtml = String(inner.data || "");
          for (const url of collectMediaUrls(innerHtml, iframeUrl)) {
            streams.push({
              server: serverName,
              link: url,
              type: /\.m3u8/i.test(url) ? "m3u8" : /\.mpd/i.test(url) ? "mpd" : "mp4",
            });
          }
          if (streams.length > 0) break;
        } catch {}
      }
    }
  } catch {}

  return streams;
}
