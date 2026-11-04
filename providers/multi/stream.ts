import { Stream, ProviderContext } from "../types";
import { multimoviesExtractor } from "../extractors/multimovies";

const BASE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

interface ServerEntry {
  name: string;
  url: string;
}

function parseServers(html: string, cheerio: any): ServerEntry[] {
  const out: ServerEntry[] = [];
  const seen = new Set<string>();
  const push = (url: string, name: string) => {
    const u = String(url || "").trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ name: name || "Server", url: u });
  };

  try {
    const $ = cheerio.load(html, { decodeEntities: false }, false);
    const selectors = [
      "button.server-chip[data-url]",
      "#playerServerGrid button[data-url]",
      ".server-grid button[data-url]",
      "[data-url][data-server-index]",
      "button[data-url]",
    ];
    let nodes: any = null;
    for (const sel of selectors) {
      const found = $(sel);
      if (found && found.length > 0) { nodes = found; break; }
    }
    if (nodes) {
      nodes.each((_: number, el: any) => {
        const $el = $(el);
        const url = String($el.attr("data-url") || "").trim();
        if (!url) return;
        let name = "";
        try { name = String($el.find(".server-name").text() || "").trim(); } catch {}
        push(url, name || $el.attr("data-id") || "Server");
      });
    }
  } catch {}

  if (out.length === 0) {
    const re = /<button[^>]*\bdata-url\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/button>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const url = String(m[1] || "").trim();
      const nameM = (m[2] || "").match(/class\s*=\s*"server-name"[^>]*>([^<]*)</i);
      push(url, nameM ? nameM[1].trim() : "Server");
    }
  }

  return out;
}

function isDirectMedia(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(m3u8|mp4|mpd|webm|m4v)$/.test(path);
  } catch {
    return false;
  }
}

export async function getStream({
  link,
  type,
  signal,
  providerContext,
}: {
  link: string;
  type: string;
  signal: AbortSignal;
  providerContext: ProviderContext;
}): Promise<Stream[]> {
  const { axios, cheerio } = providerContext;

  if (isDirectMedia(link)) {
    return [{
      server: "Direct",
      link,
      type: /\.m3u8/i.test(link) ? "m3u8" : /\.mpd/i.test(link) ? "mpd" : "mp4",
    }];
  }

  let html = "";
  try {
    const res = await axios.get(link, {
      headers: { ...BASE_HEADERS, Referer: new URL(link).origin + "/" },
      signal,
      timeout: 18000,
      maxRedirects: 5,
    });
    html = String(res.data || "");
  } catch (e: any) {
    console.error("[stream] page load failed:", e?.message);
    return [];
  }

  let servers = parseServers(html, cheerio);

  if (servers.length === 0) {
    const candidates: string[] = [];
    try {
      const $ = cheerio.load(html);
      $("[href], [data-href], [data-url], iframe[src]").each((_: number, node: any) => {
        const el = $(node);
        const raw = String(el.attr("href") || el.attr("data-href") || el.attr("data-url") || el.attr("src") || "").trim();
        if (!raw) return;
        try {
          const abs = new URL(raw, link).toString();
          if (/\/watch\/(?:movie|tv|series)\//i.test(abs)) candidates.push(abs);
        } catch {}
      });
    } catch {}

    for (const candidate of candidates.slice(0, 3)) {
      try {
        const r = await axios.get(candidate, {
          headers: { ...BASE_HEADERS, Referer: link },
          signal,
          timeout: 10000,
          maxRedirects: 4,
        });
        const parsed = parseServers(String(r.data || ""), cheerio);
        if (parsed.length > 0) { servers = parsed; break; }
      } catch {}
    }
  }

  if (servers.length === 0) {
    console.warn("[stream] no servers found on page");
    return [];
  }

  const allStreams: Stream[] = [];

  await Promise.all(servers.map(async (server) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { try { ctrl.abort(); } catch {} }, 15000);

    try {
      let resolved: Stream[] = [];

      if (isDirectMedia(server.url)) {
        resolved = [{
          server: server.name,
          link: server.url,
          type: /\.m3u8/i.test(server.url) ? "m3u8" : "mp4",
        }];
      } else {
        resolved = await multimoviesExtractor(
          server.url,
          ctrl.signal,
          axios,
          server.name,
          { ...BASE_HEADERS, Referer: link }
        );
      }

      for (const s of resolved) {
        allStreams.push({ ...s, server: s.server || server.name });
      }
    } catch {}

    clearTimeout(timer);
  }));

  return allStreams;
}
