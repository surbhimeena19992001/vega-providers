import { Info, ProviderContext } from "../types";
import { BASE, getJson, listChannels, parseLink } from "./api";

export async function getMeta({ link, providerContext }: {
  link: string; providerContext: ProviderContext;
}): Promise<Info> {
  const id = parseLink(link);
  let channel: any = null;
  try {
    const channels = await listChannels(providerContext);
    channel = channels.find((item) => String(item?.id) === id) || null;
  } catch (error: any) {
    console.warn("[TG TV] channel list failed", error?.message);
  }

  const title = String(channel?.name ?? "").trim() || "Channel " + id;
  const logo = String(channel?.logo ?? "").trim();
  const category = String(channel?.category ?? "").trim();
  let synopsis = category ? category + " · 24/7 HLS channel" : "24/7 HLS channel";

  try {
    const guide = await getJson(providerContext, "/api/public/guide/" + encodeURIComponent(id));
    const now = typeof guide?.nowPlaying === "string" ? guide.nowPlaying : guide?.nowPlaying?.title;
    const next = typeof guide?.upNext === "string" ? guide.upNext : guide?.upNext?.title;
    if (now) synopsis += "\nNow: " + String(now);
    if (next) synopsis += "\nNext: " + String(next);
  } catch { /* Guide is optional. */ }

  return {
    title,
    image: /^https?:\/\//i.test(logo) ? logo : "",
    synopsis,
    imdbId: "",
    type: "movie",
    tags: category ? [category] : undefined,
    webUrl: String(channel?.watch || BASE + "/v2/watch/" + encodeURIComponent(id)),
    linkList: [{ title: "Watch live", directLinks: [{ title: "Live", link, type: "movie" }] }],
  };
}
