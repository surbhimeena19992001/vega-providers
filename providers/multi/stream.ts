import { Stream, ProviderContext } from "../types";
import { iqstExtractor } from "../extractors/iqst";
import { vidboltExtractor } from "../extractors/vidbolt";
import { cineverseExtractor } from "../extractors/cineverse";
import { findIframeUrls, resolveEmbedHtml } from "../extractors/shared";

const BASE_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://m1.multimovies.courses/",
};

const CINEVERSE_RE = /rozgarlelo\.modiplay\.xyz\/embed\//i;
const IQST_RE      = /streams\.iqsmartgames\.com\/embed\//i;
const VIDBOLT_RE   = /vidbolt\.xyz\//i;

interface ServerEntry { name: string; url: string; index: number; }

function parseServers(html: string, cheerio: any): ServerEntry[] {
  const out: ServerEntry[] = [];
  const seen = new Set<string>();
  const push = (url: string, name: string, index: number) => {
    const u = String(url || "").trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ name: name || "Server", url: u, index });
  };

  try {
    const $ = cheerio.load(html, { decodeEntities: false }, false);
    const sels = [
      "button.server-chip[data-url]", "#playerServerGrid button[data-url]",
      ".server-grid button[data-url]", "[data-url][data-server-index]", "button[data-url]",
    ];
    let nodes: any = null;
    for (const sel of sels) {
      try { const f = $(sel); if (f && f.length > 0) { nodes = f; break; } } catch {}
    }
    if (nodes) {
      nodes.each(function (this: any, _i: number, el: any) {
        try {
          const $el = $(el);
          const url = String($el.attr("data-url") || "").trim();
          if (!url) return;
          const index = parseInt(String($el.attr("data-server-index") || "0"), 10) || 0;
          let name = "";
          try { name = String($el.find(".server-name").text() || "").trim(); } catch {}
          push(url, name || $el.attr("data-id") || "Server", index);
        } catch {}
      });
    }
  } catch {}

  if (out.length === 0) {
    const re = /<button[^>]*\bdata-url\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/button>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const url = String(m[1] || "").trim();
      const nameM = (m[2] || "").match(/class\s*=\s*"server-name"[^>]*>([^<]*)</i);
      const idxM = m[0].match(/\bdata-server-index\s*=\s*"([^"]*)"/i);
      push(url, nameM ? nameM[1].trim() : "Server", idxM ? parseInt(idxM[1], 10) || 0 : 0);
    }
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

function directType(url: string): string | null {
  try {
    const p = new URL(url);
    if (p.protocol !== "http:" && p.protocol !== "https:") return null;
    const path = p.pathname.toLowerCase();
    if (/\.m3u8$/.test(path)) return "m3u8";
    if (/\.mpd$/.test(path)) return "mpd";
    if (/\.(mp4|m4v)$/.test(path)) return "mp4";
    if (/\.webm$/.test(path)) return "webm";
  } catch {}
  return null;
}

async function routeServer(url: string, signal: AbortSignal, ctx: ProviderContext, parentPageUrl: string, serverName: string): Promise<Stream[]> {
  let referer = BASE_HEADERS.Referer;
  try { referer = new URL(parentPageUrl).origin + "/"; } catch {}
  const h = { ...BASE_HEADERS, Referer: referer };

  if (CINEVERSE_RE.test(url)) return cineverseExtractor(url, signal, ctx.axios, ctx.cheerio, h, ctx);
  if (IQST_RE.test(url))      return iqstExtractor(url, signal, ctx.axios, ctx.cheerio, h, ctx);
  if (VIDBOLT_RE.test(url))   return vidboltExtractor(url, signal, ctx.axios, ctx.cheerio, h, ctx);

  try {
    const res = await ctx.axios.get(url, { headers: h, signal, timeout: 12000 });
    const html = String(res.data || "");
    const direct = await resolveEmbedHtml(html, url, serverName);
    if (direct.length) return direct;
    for (const iframe of findIframeUrls(html, url).slice(0, 3)) {
      try {
        const inner = await ctx.axios.get(iframe, { headers: h, signal, timeout: 10000 });
        const s = await resolveEmbedHtml(String(inner.data || ""), iframe, serverName);
        if (s.length) return s;
      } catch {}
    }
  } catch {}
  return [];
}

function detectMediaType(type: string, link: string): "movie" | "tv" {
  const t = (type || "").toLowerCase();
  if (t.includes("tv") || t.includes("series") || t.includes("show")) return "tv";
  if (t.includes("movie") || t.includes("film")) return "movie";
  if (/\/tv\//i.test(link) || /\/series\//i.test(link)) return "tv";
  return "movie";
}

export async function getStream({ link, type, signal, providerContext }: {
  link: string; type: string; signal: AbortSignal; providerContext: ProviderContext;
}): Promise<Stream[]> {
  const { axios, cheerio } = providerContext;

  const directInput = directType(link);
  if (directInput) return [{ server: "Direct media", link, type: directInput }];

  let html = "";
  try {
    const res = await axios.get(link, { headers: BASE_HEADERS, signal, timeout: 18000, maxRedirects: 5 });
    html = String(res.data || "");
  } catch (e: any) {
    console.error("[stream] page load failed:", e?.message);
    return [];
  }

  const pageUrl = link;
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
          if (/\/watch\/(?:movie|tv|series)\//i.test(abs) && !candidates.includes(abs)) candidates.push(abs);
        } catch {}
      });
    } catch {}
    for (const cand of candidates.slice(0, 3)) {
      try {
        const r = await axios.get(cand, { headers: { ...BASE_HEADERS, Referer: link }, signal, timeout: 10000, maxRedirects: 4 });
        const cHtml = String(r.data || "");
        const parsed = parseServers(cHtml, cheerio);
        if (parsed.length) { servers = parsed; break; }
      } catch {}
    }
  }

  if (servers.length === 0) return [];

  const results: Stream[] = [];
  await Promise.all(servers.map(async (s) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => { try { ctrl.abort(); } catch {} }, 15000);
    try {
      const streams = await routeServer(s.url, ctrl.signal, providerContext, pageUrl, s.name);
      for (const st of streams) results.push({ ...st, server: st.server || s.name });
    } catch {}
    finally { clearTimeout(timer); }
  }));

  return results;
}
