import { Info, Link, ProviderContext } from "../types";

const headers = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

function extractAssigned(html: string, variable: string): any {
  const m = new RegExp(`(?:const|let|var)\\s+${variable}\\s*=\\s*`, "m").exec(html);
  if (!m) return null;
  const start = html.indexOf("{", m.index + m[0].length);
  if (start < 0) return null;
  let depth = 0, quote = "", esc = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

export const getMeta = async function ({ link, providerContext }: {
  link: string; providerContext: ProviderContext;
}): Promise<Info> {
  const { axios, cheerio } = providerContext;
  const url = link;
  const baseUrl = url.split("/").slice(0, 3).join("/");
  const empty: Info = { title: "", synopsis: "", image: "", imdbId: "", type: "movie", linkList: [] };

  try {
    const res = await axios.get(url, { headers: { ...headers, Referer: baseUrl } });
    const $ = cheerio.load(res.data);
    const html = String(res.data || "");
    const watchItem = extractAssigned(html, "watchItem");
    const watchConfig = extractAssigned(html, "watchConfig");

    const result: Info = { title: "", synopsis: "", image: "", imdbId: "", type: "movie", linkList: [] };
    result.title =
      watchItem?.title?.toString().trim() ||
      $(".cinejoy-detail-title").first().text().trim() ||
      "Unknown Title";
    result.image =
      watchItem?.poster ||
      $(".watch-bg img").first().attr("src") ||
      $(".cinejoy-detail-poster img").first().attr("src") || "";
    result.synopsis =
      $("#cinejoyOverview").first().text().trim() ||
      $(".cinejoy-detail-overview").first().text().trim() || "";

    const hasCards = $(".episode-card, .cinejoy-ep-card, a[href*='/season/'][href*='/episode/']").length > 0;
    const isSeriesRoute = /\/series\//i.test(new URL(url).pathname);
    const hasCinejoy = $(".cinejoy-episodes-section").length > 0;
    const statusText = $(".cinejoy-spec-box, .watch-details, .cinejoy-detail-stage").text();
    const hasStatus = /TV\s*Series|Series/i.test(statusText);
    const itemType = String(watchItem?.type || watchConfig?.type || "").toLowerCase();

    result.type =
      itemType === "tv" || itemType === "series" || hasCinejoy || hasCards ||
      isSeriesRoute || hasStatus ? "series" : "movie";
    result.imdbId = "";

    const linkList: Link[] = [];

    if (result.type === "series" || hasCinejoy) {
      const seriesBase = url.split("?")[0].replace(/\/$/, "")
        .replace(/\/season\/\d+(\/episode\/\d+)?$/i, "")
        .replace(/\/episode\/\d+$/i, "");

      const seasonMap = new Map<string, { title: string; episodesLink: string }>();

      [
        ".cinejoy-season-pill-dropdown select[aria-label='Season'] option",
        "select[aria-label='Season'] option",
        "select[name='season'] option",
        "#seasonSelect option",
        ".season-selector option",
      ].forEach((sel) => {
        $(sel).each((_: number, opt: any) => {
          const value = String($(opt).attr("value") || "").trim();
          const label = String($(opt).text() || "").replace(/\s+/g, " ").trim();
          const season = value.match(/\d+/)?.[0] || label.match(/season\s*(\d+)/i)?.[1];
          if (season) seasonMap.set(season, { title: label || `Season ${season}`, episodesLink: `${seriesBase}?season=${season}` });
        });
      });

      $(".cinejoy-season-grid").each((_: number, grid: any) => {
        const m = String($(grid).attr("id") || "").match(/cinejoy-season-(\d+)/);
        if (m && !seasonMap.has(m[1])) seasonMap.set(m[1], { title: `Season ${m[1]}`, episodesLink: `${seriesBase}?season=${m[1]}` });
      });

      if (seasonMap.size === 0) {
        const nums = new Set<string>();
        $("a[href*='/season/'], [data-season]").each((_: number, node: any) => {
          const href = String($(node).attr("href") || "");
          const s = href.match(/\/season\/(\d+)/i)?.[1] || String($(node).attr("data-season") || "").match(/\d+/)?.[0];
          if (s) nums.add(s);
        });
        if (nums.size) {
          Array.from(nums).sort((a, b) => +a - +b).forEach((s) =>
            linkList.push({ title: `Season ${s}`, quality: "", episodesLink: `${seriesBase}?season=${s}`, directLinks: [] })
          );
        } else {
          linkList.push({ title: "Season 1", quality: "", episodesLink: `${seriesBase}?season=1`, directLinks: [] });
        }
      } else {
        seasonMap.forEach((v) => linkList.push({ title: v.title, quality: "", episodesLink: v.episodesLink, directLinks: [] }));
      }
    } else {
      linkList.push({
        title: result.title, quality: "",
        episodesLink: url,
        directLinks: [{ title: result.title, link: url, type: "movie" }],
      });
    }

    result.linkList = linkList;
    return result;
  } catch (err) {
    console.log("[meta]", err);
    return empty;
  }
};
