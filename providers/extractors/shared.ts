import { Stream } from "../types";

function isMedia(u: string): boolean {
  return /\.(m3u8|mp4|mpd|webm|m4v)(\?|#|$)/i.test(u);
}

export function findMediaUrls(html: string, baseUrl: string): string[] {
  const found = new Set<string>();
  const add = (c: string) => {
    try { const abs = new URL(c, baseUrl).toString(); if (isMedia(abs)) found.add(abs); } catch {}
  };

  const jsonRe = /"(?:file|src|source|url|link|hls|dash|videoUrl|video_url|stream_url)"\s*:\s*"([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = jsonRe.exec(html)) !== null) add(m[1]);

  const directRe = /https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mp4|mpd|webm|m4v)(?:\?[^\s"'<>\\]*)?/gi;
  while ((m = directRe.exec(html)) !== null) add(m[0]);

  const b64Re = /(?:atob\s*\(\s*["']|["'])([A-Za-z0-9+/=]{40,})(?:["']\s*\)|["'])/g;
  while ((m = b64Re.exec(html)) !== null) {
    try {
      const decoded = Buffer.from(m[1], "base64").toString("utf-8");
      if (decoded && isMedia(decoded)) add(decoded);
    } catch {}
  }
  return Array.from(found);
}

export function findIframeUrls(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const re = /<iframe[^>]+src\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try { out.add(new URL(m[1], baseUrl).toString()); } catch {}
  }
  return Array.from(out);
}

export async function resolveEmbedHtml(html: string, pageUrl: string, serverName: string): Promise<Stream[]> {
  return findMediaUrls(html, pageUrl).map((u) => ({
    server: serverName,
    link: u,
    type: /\.m3u8/i.test(u) ? "m3u8" : /\.mpd/i.test(u) ? "mpd" : "mp4",
  }));
}
