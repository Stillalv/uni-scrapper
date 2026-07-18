import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { ComicItem, WebtoonInfo, Episode } from "./types";
import { fetchText, HEADERS } from "./fetcher";

export async function fetchWebtoonCatalog(lang: string, log: (msg: string) => void): Promise<ComicItem[]> {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "complete"];
  const comics: Record<string, ComicItem> = {};
  
  log(`Memulai pengambilan katalog komik lengkap untuk bahasa '${lang.toUpperCase()}'...`);
  
  const promises = days.map(async (day) => {
    const url = `https://www.webtoons.com/${lang}/originals/${day}?sortOrder=MANA`;
    const isCompleted = day === "complete";
    try {
      log(`Menghubungkan ke daftar ${day.toUpperCase()}...`);
      const html = await fetchText(url);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const links = doc.querySelectorAll('a[href*="title_no="]');
      
      links.forEach((link) => {
        const href = link.getAttribute("href");
        if (!href) return;
        
        const match = href.match(/title_no=(\d+)/);
        if (!match) return;
        const titleNo = match[1];
        
        let title = "";
        let genre = isCompleted ? "Selesai" : day.charAt(0).toUpperCase() + day.slice(1);
        
        const subjTag = link.querySelector(".subj, .title, .name");
        if (subjTag) {
          title = subjTag.textContent?.trim() || "";
        }
        
        const genreTag = link.querySelector(".genre, .category");
        if (genreTag) {
          genre = genreTag.textContent?.trim() || genre;
        } else if (isCompleted) {
          genre = "Tamat";
        }
        
        if (!title) {
          const rawText = link.textContent?.trim().replace(/\n/g, " ") || "";
          title = rawText.replace(/\s+/g, " ");
        }
        
        if (!comics[titleNo]) {
          let fullUrl = href;
          if (!href.startsWith("http")) {
            fullUrl = new URL(href, url).toString();
          }
          comics[titleNo] = {
            title_no: titleNo,
            title,
            genre,
            url: fullUrl
          };
        }
      });
    } catch (e) {
      log(`[Error] Gagal memproses daftar ${day.toUpperCase()}: ${e}`);
    }
  });
  
  await Promise.all(promises);
  
  const catalog = Object.values(comics);
  catalog.sort((a, b) => a.title.localeCompare(b.title));
  log(`Selesai! Ditemukan total ${catalog.length} komik unik di katalog.`);
  return catalog;
}

export async function resolveWebtoonInfo(inputStr: string, lang: string, log: (msg: string) => void): Promise<WebtoonInfo | null> {
  const cleanInput = inputStr.trim();
  if (!cleanInput) return null;
  
  let titleNo = "";
  if (/^\d+$/.test(cleanInput)) {
    titleNo = cleanInput;
  } else {
    const match = cleanInput.match(/title_no=(\d+)/);
    if (match) {
      titleNo = match[1];
    }
  }
  
  if (!titleNo) {
    log("[Error] Tidak dapat menemukan ID Webtoon (title_no) dari input.");
    return null;
  }
  
  let candidateUrl = "";
  if (cleanInput.toLowerCase().startsWith("http")) {
    candidateUrl = cleanInput;
  } else {
    candidateUrl = `https://www.webtoons.com/${lang}/drama/comic/list?title_no=${titleNo}`;
  }
  
  try {
    log(`Menghubungkan ke Webtoon URL/ID: ${candidateUrl}...`);
    const res = await tauriFetch(candidateUrl, { method: "GET", headers: HEADERS });
    const finalUrl = res.url || candidateUrl;
    
    let resolvedLang = lang;
    let genre = "drama";
    let titleSlug = "comic";
    
    const match = finalUrl.match(/webtoons\.com\/([^/]+)\/([^/]+)\/([^/]+)\/list/);
    if (match) {
      resolvedLang = match[1];
      genre = match[2];
      titleSlug = match[3];
    }
    
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    
    let title = "";
    const titleTag = doc.querySelector("h1.subj");
    if (titleTag) {
      title = titleTag.textContent?.trim() || "";
    } else {
      const metaTitle = doc.querySelector('meta[property="og:title"]');
      if (metaTitle) {
        title = metaTitle.getAttribute("content")?.trim() || "";
      } else {
        title = titleSlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      }
    }

    let author = "";
    const authorTag = doc.querySelector(".author, .author_area a, .creator, .author_name");
    if (authorTag) {
      author = authorTag.textContent?.trim() || "";
    }

    let synopsis = "";
    const synopsisTag = doc.querySelector("p.summary, .summary_area .summary, .detail_info .summary");
    if (synopsisTag) {
      synopsis = synopsisTag.textContent?.trim() || "";
    }

    let rating = "";
    const ratingTag = doc.querySelector("#_starScoreText, .score, .rating_score");
    if (ratingTag) {
      rating = ratingTag.textContent?.trim() || "";
    }

    let status = "Ongoing";
    const isCompleted = html.includes("txt_ico_completed") || html.includes("selesai") || html.includes("completed");
    if (isCompleted) {
      status = "Completed";
    }

    let coverUrl = "";
    const metaCover = doc.querySelector('meta[property="og:image"], meta[name="twitter:image"]');
    if (metaCover) {
      coverUrl = metaCover.getAttribute("content")?.trim() || "";
    }
    if (!coverUrl) {
      const imgTag = doc.querySelector('.detail_header .thmb img, .detail_info .thmb img, .thmb img, .info .thmb img');
      if (imgTag) {
        coverUrl = imgTag.getAttribute("src")?.trim() || "";
      }
    }
    
    return {
      lang: resolvedLang,
      genre,
      title_slug: titleSlug,
      title_no: titleNo,
      title,
      list_url: finalUrl,
      author,
      synopsis,
      rating,
      status,
      cover_url: coverUrl
    };
  } catch (e) {
    log(`[Error] Gagal menghubungkan ke server: ${e}`);
    return null;
  }
}

export async function getAllEpisodes(listUrl: string, log: (msg: string) => void): Promise<Episode[]> {
  const episodes: Episode[] = [];
  const seenEpisodes = new Set<number>();
  
  const batchSize = 10;
  let startPage = 1;
  
  async function fetchPage(pageNum: number): Promise<Episode[]> {
    const url = listUrl.includes("?") ? `${listUrl}&page=${pageNum}` : `${listUrl}?page=${pageNum}`;
    try {
      const html = await fetchText(url);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const episodeItems = doc.querySelectorAll("li._episodeItem, li[id^='episode_'], #_listUl li");
      
      const pageEpisodes: Episode[] = [];
      episodeItems.forEach((item) => {
        const epNoStr = item.getAttribute("data-episode-no");
        if (!epNoStr) return;
        const epNo = parseInt(epNoStr, 10);
        
        const aTag = item.querySelector("a");
        if (!aTag) return;
        
        let viewerUrl = aTag.getAttribute("href") || "";
        if (!viewerUrl.startsWith("http")) {
          viewerUrl = new URL(viewerUrl, url).toString();
        }
        
        const subjSpan = item.querySelector("span.subj");
        const title = subjSpan?.textContent?.trim() || `Ep. ${epNo}`;
        
        pageEpisodes.push({
          episode_no: epNo,
          title,
          url: viewerUrl
        });
      });
      return pageEpisodes;
    } catch (e) {
      log(`[Error] Gagal memuat halaman ${pageNum}: ${e}`);
      return [];
    }
  }
  
  while (true) {
    log(` -> Memuat halaman daftar ${startPage} s/d ${startPage + batchSize - 1} secara paralel...`);
    
    const pageNums = Array.from({ length: batchSize }, (_, i) => startPage + i);
    const results = await Promise.all(pageNums.map(p => fetchPage(p)));
    
    const pageResultsMap: Record<number, Episode[]> = {};
    pageNums.forEach((p, idx) => {
      pageResultsMap[p] = results[idx];
    });
    
    let emptyPageFound = false;
    let newAddedInBatch = 0;
    
    for (const p of pageNums) {
      const pageEps = pageResultsMap[p];
      if (!pageEps || pageEps.length === 0) {
        emptyPageFound = true;
        break;
      }
      
      pageEps.forEach((ep) => {
        if (!seenEpisodes.has(ep.episode_no)) {
          seenEpisodes.add(ep.episode_no);
          episodes.push(ep);
          newAddedInBatch++;
        }
      });
    }
    
    log(`    Batch selesai. Menambahkan ${newAddedInBatch} episode baru.`);
    
    if (emptyPageFound || newAddedInBatch === 0) {
      break;
    }
    
    startPage += batchSize;
    await new Promise(r => setTimeout(r, 100));
  }
  
  return episodes;
}
