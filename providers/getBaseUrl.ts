const urlsEndpoint = "https://raw.githubusercontent.com/Zenda-Cross/vega-providers/refs/heads/main/urls.json";
const fallbackUrl  = "https://m1.multimovies.courses";

type AxiosLike = { get: (url: string, cfg?: any) => Promise<{ data: any }> };

function normalise(v: string): string {
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    return u.origin.replace(/\/$/, "");
  } catch { return ""; }
}

async function discover(): Promise<string> {
  try {
    const res = await fetch("https://multimovies.wtf/", { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const re = /<a[^>]+href=["']([^"']+)["'][^>]*>\s*(?:visit\s+(?:multimovies|site)|go\s+to\s+multimovies)\s*<\/a>/i;
    const m = html.match(re);
    if (m) return normalise(m[1]);
  } catch {}
  return "";
}

export async function getBaseUrl(provider: string, _axios?: AxiosLike, _cheerio?: any): Promise<string> {
  try {
    const res = await fetch(urlsEndpoint);
    if (res.ok) {
      const data = await res.json();
      if (data[provider]) {
        const clean = normalise(data[provider]);
        if (clean) return clean;
      }
    }
  } catch {}
  const d = await discover();
  return d || fallbackUrl;
}
