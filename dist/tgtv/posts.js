"use strict";
var BASE = "https://livetgtv.lovable.app";
var PAGE_SIZE = 50;
var HEADERS = { Accept: "application/json", Referer: BASE + "/" };
var ID_RE = /^[A-Za-z0-9_.-]{1,64}$/;
function makeLink(id) { return "tgtv://v2/" + encodeURIComponent(id); }
async function getJson(ctx, path, signal) {
  var res = await ctx.axios.get(BASE + path, { headers: HEADERS, timeout: 15000, signal: signal });
  return res.data;
}
async function listChannels(ctx, signal, query) {
  var qs = query ? "?q=" + encodeURIComponent(query) : "";
  var data = await getJson(ctx, "/api/public/v2/channels" + qs, signal);
  if (Array.isArray(data)) return data;
  return Array.isArray(data && data.channels) ? data.channels : [];
}
function toPost(channel) {
  var id = String((channel && channel.id) ?? "").trim();
  var title = String((channel && channel.name) ?? "").trim();
  if (!id || !title || !ID_RE.test(id)) return null;
  var logo = String((channel && channel.logo) ?? "").trim();
  return { title: title, link: makeLink(id), image: /^https?:\/\//i.test(logo) ? logo : "" };
}
function paginate(items, page) {
  var p = Math.max(1, Number(page) || 1);
  return items.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
}
function clean(posts) { return posts.filter(function (post) { return post !== null; }); }
async function getPosts(args) {
  args = args || {};
  var page = args.page === undefined ? 1 : args.page;
  var channels = await listChannels(args.providerContext, args.signal);
  return paginate(clean(channels.map(toPost)), page);
}
async function getSearchPosts(args) {
  args = args || {};
  var query = String(args.searchQuery || "").trim();
  if (!query) return [];
  var page = args.page === undefined ? 1 : args.page;
  var channels = await listChannels(args.providerContext, args.signal, query);
  return paginate(clean(channels.map(toPost)), page);
}
exports.getPosts = getPosts;
exports.getSearchPosts = getSearchPosts;
