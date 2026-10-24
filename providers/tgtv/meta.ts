import { Info, ProviderContext } from "../types";
import { BASE, listChannels, parseLink } from "./api";

export async function getMeta({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  const id = parseLink(link);
  let channel: any = null;

  try {
    const channels = await listChannels(providerContext);
    channel = channels.find((item) => String(item?.id) === id) || null;
  } catch (error: any) {
    console.warn("[TG TV] channel metadata lookup failed", error?.message);
  }

  const title = String(channel?.name ?? "").trim() || "Channel " + id;
  const logo = String(channel?.logo ?? "").trim();
  const category = String(channel?.category ?? "").trim();
  const synopsis = category
    ? category + " · 24/7 HLS channel"
    : "24/7 HLS channel";

  return {
    title,
    image: /^https?:\/\//i.test(logo) ? logo : "",
    synopsis,
    imdbId: "",
    type: "movie",
    tags: category ? [category] : undefined,
    webUrl: String(channel?.watch || BASE + "/v2/watch/" + encodeURIComponent(id)),
    linkList: [
      {
        title: "Watch live",
        directLinks: [{ title: "Live", link, type: "movie" }],
      },
    ],
  };
}
