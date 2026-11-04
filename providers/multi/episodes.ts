import { EpisodeLink, ProviderContext } from "../types";

function clean(v: string): string { return String(v || "").replace(/\s+/g, " ").trim(); }

function parseRaw(html: string, pageUrl: string): EpisodeLink[] {
  const decode = (v: string) => String(v || "")
    .replace(/&/gi, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/gi, "/")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").trim();

  const episodes: EpisodeLink[] = [];
  const seen = new Set<string>();
  const anchors = Array.from(html.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi));

  for (const cls of ["cinejoy-ep-name", "cinejoy-ep-thumb-link", "episode-link"]) {
    for (const m of anchors) {
      const attrs = m[1] || "";
      const inner = m[2] || "";
      const className = attrs.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
      if (!new RegExp(`(?:^|\\s)${cls}(?:\\s|$)`, "i").test(className)) continue;
      const raw = attrs.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
      const hrefText = decode(raw);
      if (!hrefText || !/\/season\/\d+\/episode\/\d+/i.test(hrefText)) continue;
      let href = "";
      try { href = new URL(hrefText, pageUrl).toString(); } catch { continue; }
      if (seen.has(href)) continue;
      const titleRaw = attrs.match(/\b(?:title|aria-label)\s*=\s*(["'])(.*?)\1/i)?.[2] ||
        inner.match(/<img[^>]*\balt\s*=\s*(["'])(.*?)\1/i)?.[2] || inner.replace(/<[^>]*>/g, " ");
      const title = decode(titleRaw).replace(/\s+/g, " ").trim() || `Episode ${episodes.length + 1}`;
      seen.add(href);
      episodes.push({ title, link: href });
    }
  }
  return episodes;
}

function parse($: any, html: string, pageUrl: string, season: string): EpisodeLink[] {
  const raw = parseRaw(html, pageUrl);
  if (raw.length) return raw;

  let grid = season ? $(`#cinejoy-season-${season}`) : $(".cinejoy-season-grid.active").first();
  if (!grid.length) grid = $(".cinejoy-season-grid.active").first();
  if (!grid.length) grid = $(".cinejoy-season-grid").first();

  const episodes: EpisodeLink[] = [];
  const seen = new Set<string>();

  $(".episode-card").each((_: number, card: any) => {
    const el = $(card);
    const a = el.find("a[href*='/episode/']").first().length ? el.find("a[href*='/episode/']").first() : el.find("a[href]").first();
    const rawHref = a.attr("href") || "";
    if (!rawHref) return;
    let href = "";
    try { href = new URL(rawHref, pageUrl).toString(); } catch { return; }
    try { if (!/\/season\/\d+\/episode\/\d+/i.test(new URL(href).pathname) || seen.has(href)) return; } catch { return; }
    const title = clean(a.attr("title") || a.text() || el.find("img").first().attr("alt") || "");
    if (!title) return;
    seen.add(href);
    episodes.push({ title, link: href });
  });

  grid.find(".cinejoy-ep-card").each((_: number, card: any) => {
    const el = $(card);
    const a = el.find("a.cinejoy-ep-thumb-link").first();
    const rawHref = a.attr("href") || el.find("a.cinejoy-ep-name").first().attr("href") || "";
    if (!rawHref) return;
    let href = "";
    try { href = new URL(rawHref, pageUrl).toString(); } catch { return; }
    if (seen.has(href)) return;
    const num = clean(el.find(".cinejoy-ep-badge-num").first().text());
    const name = clean(el.find(".cinejoy-ep-name").first().text() || a.attr("title") || el.find("img").first().attr("alt") || "");
    const title = [num, name].filter(Boolean).join(" ").trim() || `Episode ${episodes.length + 1}`;
    seen.add(href);
    episodes.push({ title, link: href });
  });

  if (!episodes.length) {
    $("a[href*='/episode/'], a[data-href*='/episode/'], [data-episode-url]").each((_: number, node: any) => {
      const a = $(node);
      const rawHref = a.attr("href") || a.attr("data-href") || a.attr("data-episode-url") || "";
      let href = "";
      try { href = new URL(rawHref, pageUrl).toString(); } catch { return; }
      if (!href || seen.has(href)) return;
      const title = clean(a.attr("title") || a.text() || a.find("img").first().attr("alt") || "");
      if (!title) return;
      seen.add(href);
      episodes.push({ title, link: href });
    });
  }
  return episodes;
}

export const getEpisodes = async function ({ url, providerContext }: {
  url: string; providerContext: ProviderContext;
}): Promise<EpisodeLink[]> {
  const { axios, cheerio, commonHeaders: headers } = providerContext;
  try {
    const parsed = new URL(url);
    const season = parsed.searchParams.get("season") || "1";
    const res = await axios.get(url, { headers: { ...(headers || {}), Referer: parsed.origin + "/" } });
    return parse(cheerio.load(res.data), String(res.data || ""), url, season);
  } catch (e) {
    console.warn("[episodes]", e);
    return [];
  }
};
