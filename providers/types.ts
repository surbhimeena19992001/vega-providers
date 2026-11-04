export interface ProviderContext {
  axios: any;
  cheerio: any;
  commonHeaders?: Record<string, string>;
  kvStore?: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
}
export interface Post { title: string; link: string; image: string; provider?: string; }
export interface Stream {
  server: string; link: string; type: string;
  quality?: string; headers?: Record<string, string>; subtitles?: any[];
}
export interface Info {
  title: string; image: string; synopsis: string;
  imdbId: string; type: string; linkList: Link[];
}
export interface Link {
  title: string; quality?: string; episodesLink?: string;
  directLinks?: { title: string; link: string; type?: "movie" | "series"; }[];
}
export interface EpisodeLink { title: string; link: string; }
export interface SettingsField {
  key: string;
  type: "select" | "text" | "boolean";
  label: string; description?: string;
  options?: { label: string; value: string }[];
  defaultValue?: any;
}
