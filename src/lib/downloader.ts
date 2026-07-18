import { mkdir, writeFile, remove } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Episode, WebtoonInfo } from "./types";
import { fetchText } from "./fetcher";

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/*?:"<>|]/g, "").trim();
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export function generateComicInfoXml(info: WebtoonInfo, ep: Episode): string {
  const authorClean = info.author ? escapeXml(info.author) : "";
  const titleClean = escapeXml(ep.title);
  const seriesClean = escapeXml(info.title);
  const genreClean = escapeXml(info.genre);
  const summaryClean = info.synopsis ? escapeXml(info.synopsis) : "";
  const ratingClean = info.rating ? escapeXml(info.rating) : "";
  const statusClean = info.status ? escapeXml(info.status) : "Ongoing";

  return `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Title>${titleClean}</Title>
  <Series>${seriesClean}</Series>
  <Number>${ep.episode_no}</Number>
  <Genre>${genreClean}</Genre>
  <Summary>${summaryClean}</Summary>
  <Writer>${authorClean}</Writer>
  <LanguageISO>${info.lang}</LanguageISO>
  <CommunityRating>${ratingClean}</CommunityRating>
  <PublishingStatus>${statusClean}</PublishingStatus>
</ComicInfo>`;
}

export async function downloadEpisodes(
  selectedEpisodes: Episode[],
  info: WebtoonInfo,
  format: string,
  outputDir: string,
  threadCount: number,
  onProgress: (current: number, total: number) => void,
  log: (msg: string, replaceLast?: boolean) => void,
  cancelToken: { isCancelled: boolean },
  onEpisodeStatus?: (episodeNo: number, status: 'downloading' | 'completed' | 'failed', progress?: { current: number, total: number }) => void,
  exportType: string = "folder",
  deleteFolderAfterExport: boolean = false
): Promise<number> {
  const mimeType = format === "WEBP" ? "image/webp" : format === "PNG" ? "image/png" : "image/jpeg";
  const ext = format === "WEBP" ? ".webp" : format === "PNG" ? ".png" : ".jpg";
  
  const comicFolder = sanitizeFilename(info.title);
  const targetBase = await join(outputDir, comicFolder);
  
  try {
    await mkdir(targetBase, { recursive: true });
  } catch (e) {
    log(`[Error] Gagal membuat folder komik: ${e}`);
    return 0;
  }
  
  const totalCh = selectedEpisodes.length;
  let successCh = 0;
  
  log("\n" + "=".repeat(50));
  log(`MEMULAI UNDUHAN: ${totalCh} chapter (${format})`);
  log(`Folder Output: ${targetBase}`);
  log("=".repeat(50));
  
  for (let chIdx = 0; chIdx < totalCh; chIdx++) {
    const ep = selectedEpisodes[chIdx];
    const epNo = ep.episode_no;
    const title = ep.title;
    const url = ep.url;
    
    if (cancelToken.isCancelled) {
      log("  [Batal] Unduhan dihentikan oleh pengguna.");
      if (onEpisodeStatus) {
        onEpisodeStatus(epNo, 'failed');
      }
      break;
    }
    
    const chNum = ep.ch_num || String(epNo).padStart(3, "0");
    log(`\n[Chapter ${chNum}] ${title}`);
    onProgress(chIdx, totalCh);
    if (onEpisodeStatus) {
      onEpisodeStatus(epNo, 'downloading', { current: 0, total: 100 });
    }
    
    const folderName = ep.folder_name || sanitizeFilename(`Chapter ${chNum} - ${title}`);
    const chapterDir = await join(targetBase, folderName);
    
    try {
      await mkdir(chapterDir, { recursive: true });
    } catch (e) {
      log(`  [Gagal] Gagal membuat direktori chapter: ${e}`);
      if (onEpisodeStatus) {
        onEpisodeStatus(epNo, 'failed');
      }
      continue;
    }
    
    try {
      const html = await fetchText(url);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      
      let imgTags = doc.querySelectorAll("#_imageList img._images");
      if (imgTags.length === 0) {
        imgTags = doc.querySelectorAll("img._images");
      }
      
      if (imgTags.length === 0) {
        log("  [Gagal] Tidak ditemukan gambar pada halaman viewer.");
        if (onEpisodeStatus) {
          onEpisodeStatus(epNo, 'failed');
        }
        continue;
      }
      
      const totalImgs = imgTags.length;
      log(`  Ditemukan ${totalImgs} gambar.`);
      
      let chSuccess = 0;
      let completedImgs = 0;
      let isFirstProgress = true;
      const imgArray = Array.from(imgTags);
      
      const urls = imgArray
        .map(tag => tag.getAttribute("data-url") || tag.getAttribute("src") || "")
        .filter(urlStr => urlStr && !urlStr.includes("bg_transparency.png"));
      
      const actualTotal = urls.length;
      
      const unlisten = await listen<number>("image-downloaded", () => {
        completedImgs++;
        const percent = Math.round((completedImgs / actualTotal) * 100);
        log(`  Mengunduh gambar: ${percent}% (${completedImgs}/${actualTotal})`, !isFirstProgress);
        isFirstProgress = false;
        if (onEpisodeStatus) {
          onEpisodeStatus(epNo, 'downloading', { current: completedImgs, total: actualTotal });
        }
      });
      
      try {
        const successes = await invoke<number>("download_images_direct", {
          urls,
          folderPath: chapterDir,
          referer: url,
          threadCount,
          ext
        });
        chSuccess = successes;
      } catch (e) {
        log(`  [Error] Kegagalan saat memanggil download Rust: ${e}`);
      } finally {
        unlisten();
      }
      
      if (cancelToken.isCancelled) {
        log("  [Batal] Proses dihentikan.");
        if (onEpisodeStatus) {
          onEpisodeStatus(epNo, 'failed');
        }
        break;
      }
      
      if (chSuccess === totalImgs) {
        successCh++;
        log(`  [Sukses] ${chSuccess}/${totalImgs} gambar diunduh.`);
        
        try {
          const xmlContent = generateComicInfoXml(info, ep);
          const xmlPath = await join(chapterDir, "ComicInfo.xml");
          await writeFile(xmlPath, new TextEncoder().encode(xmlContent));
        } catch (e) {
          log(`  [Warning] Gagal menulis metadata ComicInfo.xml: ${e}`);
        }

        if (exportType === "cbz" || exportType === "folder+cbz") {
          try {
            log(`  Mengompresi ke berkas CBZ...`);
            const cbzPath = `${chapterDir}.cbz`;
            await invoke("create_cbz", { sourceDir: chapterDir, targetPath: cbzPath });
            log(`  [Ekspor] Sukses membuat berkas CBZ: ${cbzPath}`);
          } catch (e) {
            log(`  [Error] Gagal ekspor CBZ: ${e}`);
          }
        } else if (exportType === "pdf" || exportType === "folder+pdf") {
          try {
            log(`  Merakit berkas PDF...`);
            const pdfPath = `${chapterDir}.pdf`;
            await invoke("create_pdf", { sourceDir: chapterDir, targetPath: pdfPath });
            log(`  [Ekspor] Sukses membuat berkas PDF: ${pdfPath}`);
          } catch (e) {
            log(`  [Error] Gagal ekspor PDF: ${e}`);
          }
        }

        if (deleteFolderAfterExport && (exportType === "cbz" || exportType === "pdf")) {
          try {
            log(`  Membersihkan folder gambar mentah...`);
            await remove(chapterDir, { recursive: true });
          } catch (e) {
            log(`  [Warning] Gagal membersihkan folder: ${e}`);
          }
        }

        if (onEpisodeStatus) {
          onEpisodeStatus(epNo, 'completed');
        }
      } else {
        log(`  [Warning] Hanya ${chSuccess}/${totalImgs} gambar terunduh.`);
        if (onEpisodeStatus) {
          onEpisodeStatus(epNo, 'failed');
        }
      }
      
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      log(`  [Error] Terjadi kesalahan saat memproses chapter ini: ${e}`);
      if (onEpisodeStatus) {
        onEpisodeStatus(epNo, 'failed');
      }
    }
  }
  
  onProgress(totalCh, totalCh);
  return successCh;
}
