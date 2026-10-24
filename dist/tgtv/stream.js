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
function isHttp(url) { return /^https?:\/\//i.test(url); }
async function getStream(args) {
  var id = parseLink(args.link);
  try {
    var res = await args.providerContext.axios.get(BASE + "/api/public/v2/channels/" + encodeURIComponent(id), {
      headers: HEADERS, timeout: 15000, signal: args.signal
    });
    var servers = Array.isArray(res.data && res.data.servers) ? res.data.servers : [];
    var streams = [];
    var seen = new Set();
    servers.forEach(function (server, index) {
      var url = String((server && server.playable) || "").trim();
      if (!isHttp(url) || seen.has(url)) return;
      seen.add(url);
      var label = String((server && server.label) || "").trim() || "Server " + (index + 1);
      streams.push({ server: "TG TV HLS - " + label, link: url, type: "m3u8", quality: "auto" });
    });
    return streams;
  } catch (error) {
    if (error && error.response && error.response.status === 404) return [];
    var status = error && error.response && error.response.status;
    var url = error && error.config && error.config.url;
    var message = error && error.message ? error.message : String(error);
    throw new Error("TG TV stream failed: " + [status ? "HTTP " + status : "", url ? "URL " + url : "", message].filter(Boolean).join(" | "));
  }
}
exports.getStream = getStream;
