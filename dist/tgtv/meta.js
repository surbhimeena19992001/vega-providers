"use strict";
var BASE = "https://livetgtv.lovable.app";
var HEADERS = { Accept: "application/json", Referer: BASE + "/" };
var ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;
function parseLink(link) {
  var match = /^tgtv:\/\/v2\/([^/?#]+)$/.exec(String(link || "").trim());
  if (!match) throw new Error("Unsupported TG TV link");
  var id = decodeURIComponent(match[1]);
  if (!ID_RE.test(id) || id.indexOf("..") !== -1) throw new Error("Invalid TG TV channel id");
  return id;
}
async function listChannels(ctx) {
  var res = await ctx.axios.get(BASE + "/api/public/v2/channels", { headers: HEADERS, timeout: 15000 });
  var data = res.data;
  if (Array.isArray(data)) return data;
  return Array.isArray(data && data.channels) ? data.channels : [];
}
async function getMeta(args) {
  var id = parseLink(args.link);
  var channel = null;
  try {
    var channels = await listChannels(args.providerContext);
    channel = channels.find(function (item) { return String(item && item.id) === id; }) || null;
  } catch (error) {
    console.warn("[TG TV] channel metadata lookup failed", error && error.message);
  }
  var title = String((channel && channel.name) ?? "").trim() || "Channel " + id;
  var logo = String((channel && channel.logo) ?? "").trim();
  var category = String((channel && channel.category) ?? "").trim();
  var synopsis = category ? category + " · 24/7 HLS channel" : "24/7 HLS channel";
  return {
    title: title,
    image: /^https?:\/\//i.test(logo) ? logo : "",
    synopsis: synopsis,
    imdbId: "",
    type: "movie",
    tags: category ? [category] : undefined,
    webUrl: String((channel && channel.watch) || BASE + "/v2/watch/" + encodeURIComponent(id)),
    linkList: [{ title: "Watch live", directLinks: [{ title: "Live", link: args.link, type: "movie" }] }]
  };
}
exports.getMeta = getMeta;
