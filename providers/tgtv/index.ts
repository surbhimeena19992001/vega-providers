import { ProviderType } from "../types";
import { catalog, genres } from "./catalog";
import { getPosts, getSearchPosts } from "./posts";
import { getMeta } from "./meta";
import { getStream } from "./stream";

const tgtv: ProviderType = {
  catalog,
  genres,
  GetHomePosts: ({ filter, page, signal, providerValue, providerContext }) =>
    getPosts({ filter, page, signal, providerValue, providerContext }),
  GetSearchPosts: ({ searchQuery, page, signal, providerValue, providerContext }) =>
    getSearchPosts({ searchQuery, page, signal, providerValue, providerContext }),
  GetMetaData: ({ link, providerContext }) => getMeta({ link, providerContext }),
  GetStream: ({ link, type, signal, providerContext, isDownload }) =>
    getStream({ link, type, signal: signal || new AbortController().signal, providerContext, isDownload }),
};

export default tgtv;
