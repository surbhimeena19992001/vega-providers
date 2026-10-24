import { Post, ProviderContext } from "../types";
import { listChannels, paginate, toPost } from "./api";

function clean(posts: (Post | null)[]): Post[] {
  return posts.filter((post): post is Post => post !== null);
}

export async function getPosts({ page = 1, signal, providerContext }: {
  filter?: string; page?: number; providerValue?: string; signal?: AbortSignal; providerContext: ProviderContext;
}): Promise<Post[]> {
  const channels = await listChannels(providerContext, signal);
  return paginate(clean(channels.map(toPost)), page);
}

export async function getSearchPosts({ searchQuery, page = 1, signal, providerContext }: {
  searchQuery: string; page?: number; providerValue?: string; signal?: AbortSignal; providerContext: ProviderContext;
}): Promise<Post[]> {
  const query = String(searchQuery || "").trim();
  if (!query) return [];
  const channels = await listChannels(providerContext, signal, query);
  return paginate(clean(channels.map(toPost)), page);
}
