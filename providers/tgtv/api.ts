import { Post, ProviderContext } from "../types";

export const BASE = "https://livetgtv.lovable.app";
export const PAGE_SIZE = 50;
const HEADERS = { Accept: "application/json", Referer: BASE + "/" };
const ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;

export function makeLink(id: string): string {
  return "tgtv://" + encodeURIComponent(id);
}

export function parseLink(link: string): string {
  const match = /^tgtv:\/\/([^/?#]+)$/.exec(String(link || "").trim());
  if (!match) throw new Error("Unsupported TG TV link");
  const id = decodeURIComponent(match[1]);
  if (!ID_RE.test(id) || id.includes("..")) throw new Error("Invalid TG TV channel id");
  return id;
}

export async function getJson(ctx: ProviderContext, path: string, signal?: AbortSignal): Promise<any> {
  const res = await ctx.axios.get(BASE + path, { headers: HEADERS, timeout: 15000, signal });
  return res.data;
}

export async function listChannels(ctx: ProviderContext, signal?: AbortSignal, query?: string): Promise<any[]> {
  const qs = query ? "?q=" + encodeURIComponent(query) : "";
  const data = await getJson(ctx, "/api/public/v2/channels" + qs, signal);
  return Array.isArray(data) ? data : Array.isArray(data?.channels) ? data.channels : [];
}

export function toPost(channel: any): Post | null {
  const id = String(channel?.id ?? "").trim();
  const title = String(channel?.name ?? "").trim();
  if (!id || !title || !ID_RE.test(id)) return null;
  const logo = String(channel?.logo ?? "").trim();
  return { title, link: makeLink(id), image: /^https?:\/\//i.test(logo) ? logo : "" };
}

export function paginate<T>(items: T[], page: number): T[] {
  const p = Math.max(1, Number(page) || 1);
  return items.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
}
