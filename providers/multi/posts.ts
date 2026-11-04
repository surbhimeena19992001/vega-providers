import { Post, ProviderContext } from "../types";
import { getBaseUrl } from "../getBaseUrl";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7",
};

function resolveUrl(href: string | undefined, baseUrl: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return "https:" + href;
  try { return new URL(href, baseUrl).href; } catch { return ""; }
}

function posterSrc(img: any): string {
  if (!img || !img.length) return "";
  return String(img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src") || "").trim();
}

function isContentLink(link: string): boolean {
  if (!link || link.includes("#")) return false;
  for (const skip of ["/genre/", "/category/", "/tag/", "/provider/", "/collection/", "/watchlist", "/contact", "/dmca", "/privacy"]) {
    if (link.includes(skip)) return false;
  }
  return true;
}

function title(t: string): string {
  return String(t || "").replace(/\s+/g, " ").replace("Download", "").trim();
}

function dedupeKey(link: string): string {
  try {
    const u = new URL(link);
    u.hash = "";
    for (const k of Array.from(u.searchParams.keys())) {
      if (/^(utm_.+|fbclid|gclid|ref|source)$/i.test(k)) u.searchParams.delete(k);
    }
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    u.searchParams.sort();
    return u.toString();
  } catch { return link.trim(); }
}

function scrape($: any, baseUrl: string): Post[] {
  const posts: Post[] = [];
  $("article.poster-card").each((_: number, el: any) => {
    const card = $(el);
    const linkA = card.find("a.poster-art").first();
    const capA = card.find(".poster-caption a").first();
    const raw = linkA.attr("href") || capA.attr("href");
    if (!raw || !isContentLink(raw)) return;
    const link = resolveUrl(raw, baseUrl);
    if (!link || posts.some((p) => dedupeKey(p.link) === dedupeKey(link))) return;
    const img = card.find("img").first();
    const t = title(capA.text() || img.attr("alt") || "");
    if (!t) return;
    posts.push({ title: t, link, image: resolveUrl(posterSrc(img), baseUrl) });
  });

  if (posts.length === 0) {
    $("a[href*='/movie/'], a[href*='/series/']").each((_: number, node: any) => {
      const a = $(node);
      const raw = String(a.attr("href") || "");
      const link = resolveUrl(raw, baseUrl);
      if (!raw || !link) return;
      try { if (!/\/(movie|series)\//i.test(new URL(link).pathname)) return; } catch { return; }
      if (posts.some((p) => dedupeKey(p.link) === dedupeKey(link))) return;
      const card = a.closest("article, li, .item, .card, .poster, div");
      const img = a.find("img").first().length ? a.find("img").first() : card.find("img").first();
      const t = title(a.attr("title") || a.text() || img.attr("alt") || "");
      if (t) posts.push({ title: t, link, image: resolveUrl(posterSrc(img), baseUrl) });
    });
  }
  return posts;
}

export async function getPosts({ filter, page = 1, signal, providerContext }: {
  filter?: string; page?: number; signal?: AbortSignal; providerContext: ProviderContext;
}): Promise<Post[]> {
  const { axios, cheerio } = providerContext;
  const baseUrl = (await getBaseUrl("multi", axios, cheerio)).replace(/\/+$/, "");
  const route = (filter || "trending").replace(/^\/+/, "").replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/catalog`);
  if (route === "trending") url.searchParams.set("sort", "rating");
  else if (route === "movies") { url.searchParams.set("type", "movie"); url.searchParams.set("sort", "latest"); }
  else if (route === "series") { url.searchParams.set("type", "tv"); url.searchParams.set("sort", "latest"); }
  else if (route.startsWith("genre/")) { url.searchParams.set("genre", route.slice(6)); url.searchParams.set("sort", "latest"); }
  else { url.searchParams.set("genre", route); url.searchParams.set("sort", "latest"); }
  url.searchParams.set("page", String(Math.max(1, page)));

  try {
    const res = await axios.get(url.href, { headers: { ...HEADERS, Referer: baseUrl }, signal, timeout: 15000, maxRedirects: 5 });
    return scrape(cheerio.load(res.data), baseUrl).slice(0, 100);
  } catch (e: any) {
    console.error("[posts]", e?.message);
    return [];
  }
}

export async function getSearchPosts({ searchQuery, page = 1, signal, providerContext }: {
  searchQuery: string; page?: number; signal?: AbortSignal; providerContext: ProviderContext;
}): Promise<Post[]> {
  const { axios, cheerio } = providerContext;
  const baseUrl = (await getBaseUrl("multi", axios, cheerio)).replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/catalog`);
  url.searchParams.set("q", searchQuery.trim());
  url.searchParams.set("sort", "latest");
  url.searchParams.set("page", String(Math.max(1, page)));
  try {
    const res = await axios.get(url.href, { headers: { ...HEADERS, Referer: baseUrl }, signal, timeout: 15000, maxRedirects: 5 });
    return scrape(cheerio.load(res.data), baseUrl).slice(0, 100);
  } catch (e: any) {
    console.error("[search]", e?.message);
    return [];
  }
}
