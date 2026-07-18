export interface ComicItem {
  title_no: string;
  title: string;
  genre: string;
  url: string;
}

export interface WebtoonInfo {
  lang: string;
  genre: string;
  title_slug: string;
  title_no: string;
  title: string;
  list_url: string;
  author?: string;
  synopsis?: string;
  rating?: string;
  status?: string;
  cover_url?: string;
}

export interface Episode {
  episode_no: number;
  title: string;
  url: string;
  ch_num?: string;
  folder_name?: string;
}
