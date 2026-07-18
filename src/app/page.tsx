"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  Download, 
  Folder, 
  Settings, 
  FileText, 
  RefreshCw, 
  Trash2, 
  Info, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Globe, 
  ChevronUp, 
  ChevronDown,
  PanelTopClose,
  PanelTop,
  Sun,
  Moon,
  X,
  BookOpen
} from "lucide-react";
import { 
  fetchWebtoonCatalog, 
  resolveWebtoonInfo, 
  getAllEpisodes, 
  downloadEpisodes, 
  sanitizeFilename,
  Episode, 
  ComicItem, 
  WebtoonInfo 
} from "@/lib/scraper";

const NumberInput = ({ 
  value, 
  onChange, 
  placeholder, 
  min = 1 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  placeholder: string; 
  min?: number;
}) => {
  const handleIncrement = () => {
    const curr = parseInt(value, 10) || 0;
    onChange(String(curr + 1));
  };
  const handleDecrement = () => {
    const curr = parseInt(value, 10) || 0;
    if (curr > min) {
      onChange(String(curr - 1));
    }
  };
  return (
    <div className="relative flex-1">
      <input 
        type="number"
        min={min}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-input-bg border border-input-border rounded-lg pl-3 pr-8 py-2 text-xs text-foreground placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-center"
      />
      <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-center border-l border-card-border/80 pl-1.5 pr-0.5">
        <button 
          type="button"
          onClick={handleIncrement}
          className="text-muted hover:text-foreground active:scale-75 transition-all p-0.5"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button 
          type="button"
          onClick={handleDecrement}
          className="text-muted hover:text-foreground active:scale-75 transition-all p-0.5"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

export default function Home() {
  const [lang, setLang] = useState<"id" | "en">("id");
  const [leftTab, setLeftTab] = useState<"catalog" | "queue">("catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortCol, setSortCol] = useState<"ID" | "Judul" | "Genre">("Judul");
  const [sortDesc, setSortDesc] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  
  const [urlInput, setUrlInput] = useState("");
  const [imageFormat, setImageFormat] = useState<"WEBP" | "JPEG" | "PNG">("WEBP");
  const [outputDir, setOutputDir] = useState("");
  const [chapterSelectionMode, setChapterSelectionMode] = useState<"all" | "latest" | "range" | "specific" | "custom">("all");
  const [chapterDropdownOpen, setChapterDropdownOpen] = useState(false);
  const [selectedCustomChapters, setSelectedCustomChapters] = useState<number[]>([]);
  const [showCustomChapterModal, setShowCustomChapterModal] = useState(false);
  const [chapterStart, setChapterStart] = useState("");
  const [chapterEnd, setChapterEnd] = useState("");
  const [chapterSpecificList, setChapterSpecificList] = useState("");
  const [threadCount, setThreadCount] = useState(3);
  const [exportType, setExportType] = useState<"folder" | "cbz" | "pdf" | "folder+cbz" | "folder+pdf">("folder");
  const [deleteFolderAfterExport, setDeleteFolderAfterExport] = useState(false);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  interface QueueItem {
    id: string;
    comicTitle: string;
    info: WebtoonInfo;
    episodes: Episode[];
    format: "WEBP" | "JPEG" | "PNG";
    exportType: "folder" | "cbz" | "pdf" | "folder+cbz" | "folder+pdf";
    deleteFolderAfterExport: boolean;
    outputDir: string;
    threadCount: number;
    status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
    progress: { current: number; total: number };
  }
  const [queueList, setQueueList] = useState<QueueItem[]>([]);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const queueRunningRef = useRef(false);
  const activeQueueIndexRef = useRef<number>(-1);
  
  const [downloadQueue, setDownloadQueue] = useState<Array<{ id: number; name: string; status: 'idle' | 'downloading' | 'completed' | 'failed'; progress?: { current: number; total: number } }>>([]);
  const [showDownloadsDropdown, setShowDownloadsDropdown] = useState(false);
  
  const [catalog, setCatalog] = useState<ComicItem[]>([]);
  const [filteredCatalog, setFilteredCatalog] = useState<ComicItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [webtoonInfo, setWebtoonInfo] = useState<WebtoonInfo | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodeMap, setEpisodeMap] = useState<Record<number, Episode>>({});
  
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [downloadStatus, setDownloadStatus] = useState("Idle");
  const [logs, setLogs] = useState<string[]>([]);
  
  const cancelTokenRef = useRef({ isCancelled: false });
  const logEndRef = useRef<HTMLDivElement>(null);
  const [isTauriEnv, setIsTauriEnv] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      setIsTauriEnv(true);
      import("@tauri-apps/api/path").then(async ({ documentDir }) => {
        try {
          const docDir = await documentDir();
          setOutputDir(docDir);
        } catch (_) {
          setOutputDir("C:\\Downloads");
        }
      });
    } else {
      setOutputDir("/downloads");
    }
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    handleLoadCatalog();
  }, [lang]);

  useEffect(() => {
    let result = [...catalog];
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        item => 
          item.title.toLowerCase().includes(q) || 
          item.title_no.includes(q) || 
          item.genre.toLowerCase().includes(q)
      );
    }
    
    result.sort((a, b) => {
      let valA = "";
      let valB = "";
      
      if (sortCol === "ID") {
        const idA = parseInt(a.title_no, 10) || 0;
        const idB = parseInt(b.title_no, 10) || 0;
        return sortDesc ? idB - idA : idA - idB;
      } else if (sortCol === "Judul") {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
      } else if (sortCol === "Genre") {
        valA = a.genre.toLowerCase();
        valB = b.genre.toLowerCase();
      }
      
      return sortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
    });
    
    setFilteredCatalog(result);
  }, [catalog, searchQuery, sortCol, sortDesc]);

  const addLog = (msg: string, replaceLast = false) => {
    setLogs(prev => {
      if (replaceLast && prev.length > 0) {
        return [...prev.slice(0, -1), msg];
      }
      return [...prev, msg];
    });
  };

  const handleLoadCatalog = async () => {
    if (catalogLoading) return;
    setCatalogLoading(true);
    setLogs([]);
    addLog(`=== MEMUAT KATALOG WEBTOON (${lang.toUpperCase()}) ===`);
    try {
      const data = await fetchWebtoonCatalog(lang, addLog);
      setCatalog(data);
    } catch (e: any) {
      addLog(`[Error] Gagal memuat katalog: ${e.message || e}`);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleSort = (col: "ID" | "Judul" | "Genre") => {
    if (sortCol === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortCol(col);
      setSortDesc(false);
    }
  };

  const handleBrowseFolder = async () => {
    if (isTauriEnv) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          directory: true,
          multiple: false,
          title: "Pilih Folder Penyimpanan"
        });
        if (selected && typeof selected === "string") {
          setOutputDir(selected);
        }
      } catch (e: any) {
        addLog(`[Error] Gagal membuka folder dialog: ${e.message || e}`);
      }
    } else {
      alert("Fitur pemilihan folder lokal hanya didukung saat berjalan di aplikasi Desktop Tauri!");
    }
  };

  const handleCheckInfo = async (customUrl?: string) => {
    const targetUrl = customUrl || urlInput.trim();
    if (!targetUrl) {
      alert("Harap masukkan URL atau ID Webtoon!");
      return;
    }
    
    setInfoLoading(true);
    setWebtoonInfo(null);
    setEpisodes([]);
    addLog("\n--------------------------------------------------");
    addLog("Memulai validasi informasi komik...");
    
    try {
      const info = await resolveWebtoonInfo(targetUrl, lang, addLog);
      if (!info) {
        addLog("[Error] Gagal mengurai detail komik. Silakan periksa URL/ID.");
        alert("Gagal memproses informasi Webtoon. Pastikan URL/ID benar.");
        return;
      }
      
      setWebtoonInfo(info);
      addLog(`Komik teridentifikasi: ${info.title}`);
      
      const eps = await getAllEpisodes(info.list_url, addLog);
      
      let lastMainEp = 0.0;
      let specialCount = 0;
      const seasonOffsets: Record<number, number> = {};
      const seasonPattern = /(?:S|Season\s*)(\d+)\s*Ep\.?\s*(\d+(?:\.\d+)?)/i;
      const epPattern = /(?:[Ee]p\.?\s*|Episode\s*|Ep\s+)(\d+(?:\.\d+)?)/i;
      
      const enrichedEps = eps.map((ep) => {
        const title = ep.title;
        let chNum = "";
        const sMatch = title.match(seasonPattern);
        
        if (sMatch) {
          const season = parseInt(sMatch[1], 10);
          const episode = parseFloat(sMatch[2]);
          let actualEp = episode;
          
          if (season > 1) {
            if (seasonOffsets[season] === undefined) {
              seasonOffsets[season] = lastMainEp;
            }
            actualEp = seasonOffsets[season] + episode;
          } else {
            actualEp = episode;
          }
          
          lastMainEp = actualEp;
          specialCount = 0;
          
          chNum = Number.isInteger(actualEp) 
            ? String(Math.floor(actualEp)).padStart(3, "0")
            : `${String(Math.floor(actualEp)).padStart(3, "0")}.${String(actualEp).split(".")[1]}`;
        } else {
          const epMatch = title.match(epPattern);
          if (epMatch) {
            const actualEp = parseFloat(epMatch[1]);
            lastMainEp = actualEp;
            specialCount = 0;
            chNum = Number.isInteger(actualEp)
              ? String(Math.floor(actualEp)).padStart(3, "0")
              : `${String(Math.floor(actualEp)).padStart(3, "0")}.${String(actualEp).split(".")[1]}`;
          } else {
            specialCount++;
            if (specialCount === 1) {
              chNum = `${String(Math.floor(lastMainEp)).padStart(3, "0")}.5`;
            } else {
              chNum = `${String(Math.floor(lastMainEp)).padStart(3, "0")}.5.${specialCount - 1}`;
            }
          }
        }
        
        return {
          ...ep,
          ch_num: chNum,
          folder_name: sanitizeFilename(`Chapter ${chNum} - ${title}`)
        };
      });
      
      setEpisodes(enrichedEps);
      
      const map: Record<number, Episode> = {};
      enrichedEps.forEach(ep => {
        map[ep.episode_no] = ep;
      });
      setEpisodeMap(map);
      
      addLog(`Sukses! Menemukan ${enrichedEps.length} episode. Siap untuk diunduh.`);
    } catch (e: any) {
      addLog(`[Error] Gagal memeriksa informasi komik: ${e.message || e}`);
    } finally {
      setInfoLoading(false);
    }
  };

  const handleExportMetadataJson = async () => {
    if (!webtoonInfo) {
      alert("Silakan cek informasi komik terlebih dahulu!");
      return;
    }

    if (episodes.length === 0) {
      alert("Daftar episode belum selesai dimuat. Harap tunggu sebentar lalu coba lagi!");
      return;
    }

    const exportData = {
      title: webtoonInfo.title,
      title_no: webtoonInfo.title_no,
      author: webtoonInfo.author || "",
      synopsis: webtoonInfo.synopsis || "",
      genre: webtoonInfo.genre,
      rating: webtoonInfo.rating || "",
      status: webtoonInfo.status || "Ongoing",
      cover_url: webtoonInfo.cover_url || "",
      lang: webtoonInfo.lang,
      list_url: webtoonInfo.list_url,
      total_episodes: episodes.length,
      exported_at: new Date().toISOString(),
      episodes: episodes.map(ep => ({
        episode_no: ep.episode_no,
        title: ep.title,
        ch_num: ep.ch_num,
        url: ep.url
      }))
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const defaultFileName = `${sanitizeFilename(webtoonInfo.title)}_metadata.json`;

    try {
      if (isTauriEnv) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        
        const filePath = await save({
          defaultPath: defaultFileName,
          filters: [{ name: "JSON Metadata", extensions: ["json"] }]
        });

        if (filePath) {
          await writeFile(filePath, new TextEncoder().encode(jsonString));
          addLog(`[Metadata] Sukses menyimpan metadata JSON ke: ${filePath}`);
          alert(`Metadata berhasil disimpan ke berkas JSON:\n${filePath}`);
        }
      } else {
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = defaultFileName;
        a.click();
        URL.revokeObjectURL(url);
        addLog(`[Metadata] Berhasil mengunduh metadata JSON: ${defaultFileName}`);
      }
    } catch (e: any) {
      addLog(`[Error] Gagal mengekspor metadata JSON: ${e.message || e}`);
    }
  };

  const handleComicSelect = (comic: ComicItem) => {
    setUrlInput(comic.url);
    handleCheckInfo(comic.url);
  };

  const parseChapterSelection = (): Episode[] => {
    const selected: Episode[] = [];
    
    if (chapterSelectionMode === "all") {
      return [...episodes];
    }
    
    if (chapterSelectionMode === "latest") {
      if (episodes.length === 0) return [];
      const sorted = [...episodes].sort((a, b) => b.episode_no - a.episode_no);
      return [sorted[0]];
    }
    
    if (chapterSelectionMode === "range") {
      const start = parseInt(chapterStart, 10) || 1;
      const end = parseInt(chapterEnd, 10) || Math.max(...Object.keys(episodeMap).map(Number));
      
      Object.keys(episodeMap).map(Number).sort((a,b)=>a-b).forEach(epNo => {
        if (epNo >= start && epNo <= end) {
          selected.push(episodeMap[epNo]);
        }
      });
      return selected;
    }
    
    if (chapterSelectionMode === "specific") {
      const parts = chapterSpecificList.split(",");
      parts.forEach(part => {
        const epNo = parseInt(part.trim(), 10);
        if (epNo && episodeMap[epNo]) {
          selected.push(episodeMap[epNo]);
        }
      });
      return selected;
    }

    if (chapterSelectionMode === "custom") {
      return episodes.filter(ep => selectedCustomChapters.includes(ep.episode_no));
    }
    
    return selected;
  };

  const handleStartDownload = async () => {
    if (!webtoonInfo || episodes.length === 0) {
      alert("Silakan cek informasi komik terlebih dahulu!");
      return;
    }
    
    if (!outputDir) {
      alert("Harap tentukan folder penyimpanan!");
      return;
    }
    
    const selected = parseChapterSelection();
    if (selected.length === 0) {
      alert("Chapter yang dipilih tidak valid atau tidak cocok dengan daftar!");
      return;
    }
    
    setIsDownloading(true);
    setDownloadStatus("Downloading");
    cancelTokenRef.current.isCancelled = false;
    
    const initialQueue = selected.map(ep => ({
      id: ep.episode_no,
      name: ep.ch_num ? `Chapter ${ep.ch_num} - ${ep.title}` : `Episode ${ep.episode_no} - ${ep.title}`,
      status: 'idle' as 'idle' | 'downloading' | 'completed' | 'failed'
    }));
    setDownloadQueue(initialQueue);
    setShowDownloadsDropdown(true);
    
    try {
      const successCount = await downloadEpisodes(
        selected,
        webtoonInfo,
        imageFormat,
        outputDir,
        threadCount,
        (curr, tot) => setDownloadProgress({ current: curr, total: tot }),
        addLog,
        cancelTokenRef.current,
        (episodeNo, status, progress) => {
          setDownloadQueue(prev => 
            prev.map(item => 
              item.id === episodeNo ? { ...item, status, progress } : item
            )
          );
        },
        exportType,
        deleteFolderAfterExport
      );
      
      setDownloadStatus(cancelTokenRef.current.isCancelled ? "Cancelled" : "Completed");
      if (cancelTokenRef.current.isCancelled) {
        alert(`Unduhan dihentikan.\nChapter berhasil diunduh: ${successCount} dari ${selected.length}`);
      } else {
        alert(`Unduhan selesai!\nBerhasil mengunduh ${successCount} dari ${selected.length} chapter.`);
      }
    } catch (e: any) {
      addLog(`[Error] Kegagalan unduhan fatal: ${e.message || e}`);
      setDownloadStatus("Error");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancelDownload = () => {
    cancelTokenRef.current.isCancelled = true;
    setDownloadStatus("Cancelling");
    addLog("\n[Batal] Permintaan pembatalan diterima. Menyelesaikan proses saat ini...");
  };

  const handleAddToQueue = () => {
    if (!webtoonInfo || episodes.length === 0) {
      alert("Silakan cek informasi komik terlebih dahulu!");
      return;
    }

    const selected = parseChapterSelection();
    if (selected.length === 0) {
      alert("Tidak ada chapter yang terpilih untuk diunduh!");
      return;
    }

    const newItem: QueueItem = {
      id: Math.random().toString(36).substring(2, 9),
      comicTitle: webtoonInfo.title,
      info: webtoonInfo,
      episodes: selected,
      format: imageFormat,
      exportType: exportType,
      deleteFolderAfterExport: deleteFolderAfterExport,
      outputDir: outputDir || "C:\\Users\\Administrator\\Downloads\\unicomic-main\\uni-scraper",
      threadCount: threadCount,
      status: 'pending',
      progress: { current: 0, total: selected.length }
    };

    setQueueList(prev => [...prev, newItem]);
    addLog(`[Antrean] Ditambahkan ke antrean: ${webtoonInfo.title} (${selected.length} chapter)`);
  };

  const handleRemoveFromQueue = (id: string) => {
    setQueueList(prev => prev.filter(item => item.id !== id));
  };

  const handleClearQueue = () => {
    if (isQueueRunning) {
      alert("Hentikan antrean terlebih dahulu sebelum membersihkan!");
      return;
    }
    setQueueList([]);
  };

  const processQueue = async () => {
    if (queueRunningRef.current) {
      cancelTokenRef.current.isCancelled = true;
      addLog("\n[Antrean] Menjeda proses antrean...");
      return;
    }

    queueRunningRef.current = true;
    setIsQueueRunning(true);
    cancelTokenRef.current.isCancelled = false;

    addLog("\n" + "=".repeat(50));
    addLog("=== MEMULAI ANTREAN UNDUHAN ===");
    addLog("=".repeat(50));

    while (true) {
      let foundItem: QueueItem | null = null;
      let targetIndex = -1;

      await new Promise<void>(resolve => {
        setQueueList(latest => {
          const idx = latest.findIndex(item => item.status === 'pending');
          if (idx !== -1) {
            foundItem = latest[idx];
            targetIndex = idx;
          }
          resolve();
          return latest;
        });
      });

      const targetItem = foundItem as QueueItem | null;
      if (!targetItem || targetIndex === -1 || cancelTokenRef.current.isCancelled) {
        break;
      }

      setQueueList(prev => prev.map((item, idx) => idx === targetIndex ? { ...item, status: 'downloading' } : item));
      activeQueueIndexRef.current = targetIndex;
      setIsDownloading(true);
      setDownloadStatus("Downloading");
      setDownloadProgress({ current: 0, total: targetItem.episodes.length });

      addLog(`\n[Antrean #${targetIndex + 1}] Memulai unduhan: ${targetItem.comicTitle}`);

      try {
        const successCount = await downloadEpisodes(
          targetItem.episodes,
          targetItem.info,
          targetItem.format,
          targetItem.outputDir,
          targetItem.threadCount,
          (curr, tot) => {
            setDownloadProgress({ current: curr, total: tot });
            setQueueList(prev => prev.map((item, idx) => idx === targetIndex ? { ...item, progress: { current: curr, total: tot } } : item));
          },
          (msg, replaceLast) => addLog(msg, replaceLast),
          cancelTokenRef.current,
          undefined,
          targetItem.exportType,
          targetItem.deleteFolderAfterExport
        );

        const isCancelled = cancelTokenRef.current.isCancelled;
        const finalStatus = isCancelled ? 'cancelled' : (successCount === targetItem.episodes.length ? 'completed' : 'failed');
        
        setQueueList(prev => prev.map((item, idx) => idx === targetIndex ? { ...item, status: finalStatus } : item));
        addLog(`[Antrean #${targetIndex + 1}] Selesai: ${targetItem.comicTitle} (${successCount}/${targetItem.episodes.length} sukses)`);
        
        if (isCancelled) break;
      } catch (err: any) {
        setQueueList(prev => prev.map((item, idx) => idx === targetIndex ? { ...item, status: 'failed' } : item));
        addLog(`[Error] Gagal memproses antrean #${targetIndex + 1}: ${err.message || err}`);
      }

      setIsDownloading(false);
      setDownloadStatus("Idle");
      activeQueueIndexRef.current = -1;
      await new Promise(r => setTimeout(r, 1000));
    }

    queueRunningRef.current = false;
    setIsQueueRunning(false);
    setIsDownloading(false);
    setDownloadStatus("Idle");
    activeQueueIndexRef.current = -1;
    addLog("\n=== ANTREAN UNDUHAN SELESAI / DIJEDA ===");
  };

  return (
    <main className={`h-screen max-h-screen bg-background text-foreground flex flex-col font-sans antialiased selection:bg-primary/20 overflow-hidden transition-colors duration-200 ${theme}`}>
      <header className="border-b border-card-border bg-card-bg/85 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-400 to-sky-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Download className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-muted bg-clip-text text-transparent">
              UniScraper Desktop
            </h1>
            <p className="text-xs text-muted">LINE Webtoon Downloader & Image Converter</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-xl bg-card-bg border border-card-border hover:bg-table-hover text-muted hover:text-foreground transition-all duration-200 active:scale-90"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun className="h-4.5 w-4.5 text-amber-400" /> : <Moon className="h-4.5 w-4.5 text-sky-600" />}
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowDownloadsDropdown(!showDownloadsDropdown)}
              className={`p-2 rounded-xl bg-card-bg border hover:bg-table-hover transition-all duration-200 active:scale-90 relative ${
                isDownloading ? "text-primary border-primary/40" : "text-muted hover:text-foreground border-card-border"
              }`}
              title="Unduhan (Download Manager)"
            >
              <Download className={`h-4.5 w-4.5 ${isDownloading ? "animate-bounce" : ""}`} />
              {isDownloading && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
              )}
            </button>
            
            {showDownloadsDropdown && (
              <div className="absolute right-0 mt-2 w-80 max-h-[380px] bg-card-bg border border-card-border rounded-xl shadow-xl z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-3 border-b border-card-border bg-panel-bg flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5 text-primary" />
                    Download Manager
                  </span>
                  {downloadQueue.length > 0 && (
                    <button 
                      onClick={() => setDownloadQueue([])}
                      className="text-[10px] font-semibold text-muted hover:text-foreground hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1.5">
                  {downloadQueue.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted">
                      Tidak ada unduhan aktif atau selesai.
                    </div>
                  ) : (
                    downloadQueue.map((item) => (
                      <div key={item.id} className="p-2 rounded-lg bg-panel-bg/40 border border-card-border/50 flex flex-col gap-1 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground truncate max-w-[170px]" title={item.name}>
                            {item.name}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            item.status === 'downloading' ? 'bg-sky-500/10 text-primary animate-pulse' :
                            item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                            item.status === 'failed' ? 'bg-rose-500/10 text-rose-500' :
                            'bg-muted/10 text-muted'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        {item.status === 'downloading' && (
                          <div className="flex flex-col gap-1 mt-1">
                            <div className="h-1 w-full bg-card-bg rounded-full overflow-hidden border border-card-border/40">
                              <div 
                                className="h-full bg-primary rounded-full transition-all duration-300" 
                                style={{ width: `${item.progress ? (item.progress.current / item.progress.total) * 100 : 0}%` }}
                              ></div>
                            </div>
                            {item.progress && (
                              <div className="flex justify-between text-[9px] text-muted">
                                <span>Unduh Gambar</span>
                                <span>{Math.round((item.progress.current / item.progress.total) * 100)}% ({item.progress.current}/{item.progress.total})</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
                
                {isDownloading && (
                  <div className="p-3 border-t border-card-border bg-panel-bg flex flex-col gap-1.5">
                    <div className="flex justify-between text-[10px] font-semibold text-muted">
                      <span>Total Unduhan</span>
                      <span>{downloadProgress.current} / {downloadProgress.total}</span>
                    </div>
                    <div className="h-1.5 w-full bg-card-bg rounded-full overflow-hidden border border-card-border/40">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        <section className="lg:col-span-5 border-r border-card-border flex flex-col h-full min-h-0 bg-background overflow-hidden">
          <div className="flex border-b border-card-border bg-panel-bg flex-shrink-0">
            <button
              onClick={() => setLeftTab("catalog")}
              type="button"
              className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                leftTab === "catalog" 
                  ? "border-primary text-primary bg-card-bg/50" 
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <Globe className="h-4 w-4" />
              Katalog Webtoon
            </button>
            <button
              onClick={() => setLeftTab("queue")}
              type="button"
              className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer relative ${
                leftTab === "queue" 
                  ? "border-primary text-primary bg-card-bg/50" 
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <FileText className="h-4 w-4" />
              Antrean Unduhan
              {queueList.length > 0 && (
                <span className="absolute right-4 px-1.5 py-0.5 text-[9px] rounded-full bg-primary text-white font-bold animate-pulse">
                  {queueList.length}
                </span>
              )}
            </button>
          </div>

          {leftTab === "queue" ? (
            <div className="flex-1 min-h-0 flex flex-col p-4 overflow-hidden">
              <div className="flex-shrink-0 flex items-center justify-between mb-3">
                <div className="flex flex-col">
                  <h3 className="text-xs font-bold text-foreground">Pengelola Antrean</h3>
                  <span className="text-[10px] text-muted">
                    {queueList.filter(i => i.status === 'pending').length} pending, {queueList.filter(i => i.status === 'completed').length} selesai
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={processQueue}
                    type="button"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all active:scale-95 cursor-pointer ${
                      isQueueRunning 
                        ? "bg-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/10" 
                        : "bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/10"
                    }`}
                  >
                    {isQueueRunning ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Jeda Antrean
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        Mulai Antrean
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleClearQueue}
                    type="button"
                    disabled={queueList.length === 0 || isQueueRunning}
                    className="px-3 py-1.5 rounded-lg border border-card-border bg-card-bg text-rose-500 hover:bg-rose-500/5 active:scale-95 transition-all text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    Bersihkan
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 border border-card-border bg-card-bg rounded-xl overflow-hidden flex flex-col shadow-sm">
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
                  {queueList.length === 0 ? (
                    <div className="m-auto flex flex-col items-center gap-1.5 text-muted text-xs select-none">
                      <FileText className="h-6 w-6 text-muted/60" />
                      <p>Antrean kosong. Tambah komik ke antrean.</p>
                    </div>
                  ) : (
                    queueList.map((item, idx) => {
                      const isDownloadingItem = item.status === 'downloading';
                      const isCompletedItem = item.status === 'completed';
                      const isFailedItem = item.status === 'failed';
                      const isCancelledItem = item.status === 'cancelled';
                      
                      const percent = item.progress.total > 0 ? Math.round((item.progress.current / item.progress.total) * 100) : 0;
                      
                      return (
                        <div 
                          key={item.id} 
                          className={`p-3 rounded-lg border flex flex-col gap-2 transition-all ${
                            isDownloadingItem ? "bg-primary/5 border-primary" :
                            isCompletedItem ? "bg-emerald-500/5 border-emerald-500/20 opacity-75" :
                            isFailedItem || isCancelledItem ? "bg-rose-500/5 border-rose-500/20" :
                            "bg-panel-bg border-card-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-foreground truncate">{item.comicTitle}</span>
                              <span className="text-[10px] text-muted">
                                {item.episodes.length} chapter • {item.format} • {item.exportType.toUpperCase()}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase ${
                                item.status === 'pending' ? "bg-card-bg border-card-border text-muted" :
                                item.status === 'downloading' ? "bg-primary/10 border-primary/20 text-primary animate-pulse" :
                                item.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                                "bg-rose-500/10 border-rose-500/20 text-rose-500"
                              }`}>
                                {item.status}
                              </span>
                              
                              <button
                                onClick={() => handleRemoveFromQueue(item.id)}
                                type="button"
                                disabled={isDownloadingItem}
                                className="p-1 rounded-md hover:bg-card-bg text-muted hover:text-rose-500 transition-colors disabled:opacity-30 cursor-pointer"
                                title="Hapus dari antrean"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {(isDownloadingItem || item.progress.current > 0) && (
                            <div className="flex flex-col gap-1">
                              <div className="flex justify-between text-[9px] text-muted font-bold">
                                <span>Kemajuan: {percent}%</span>
                                <span>{item.progress.current}/{item.progress.total} Ch</span>
                              </div>
                              <div className="h-1.5 w-full bg-card-bg border border-card-border rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isCompletedItem ? "bg-emerald-500" :
                                    isFailedItem || isCancelledItem ? "bg-rose-500" :
                                    "bg-primary"
                                  }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-card-border bg-panel-bg flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center bg-card-bg p-1 rounded-lg border border-card-border">
                    <button 
                      onClick={() => setLang("id")}
                      type="button"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${lang === "id" ? "bg-primary text-white shadow" : "text-muted hover:text-foreground"}`}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Indonesia (id)
                    </button>
                    <button 
                      onClick={() => setLang("en")}
                      type="button"
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${lang === "en" ? "bg-primary text-white shadow" : "text-muted hover:text-foreground"}`}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      English (en)
                    </button>
                  </div>
                  
                  <button 
                    onClick={handleLoadCatalog}
                    type="button"
                    disabled={catalogLoading}
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-card-bg border border-card-border text-xs font-semibold text-foreground hover:bg-table-hover active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${catalogLoading ? "animate-spin text-primary" : ""}`} />
                    Reload
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-muted" />
                  <input 
                    type="text" 
                    placeholder="Cari judul komik atau genre..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-input-bg border border-input-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 p-4 overflow-hidden flex flex-col">
                <div className="flex-1 min-h-0 border border-card-border bg-card-bg rounded-xl overflow-hidden flex flex-col shadow-sm">
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {catalogLoading ? (
                      <div className="h-64 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <span className="text-xs text-muted">Memuat katalog LINE Webtoon...</span>
                      </div>
                    ) : filteredCatalog.length === 0 ? (
                      <div className="h-64 flex flex-col items-center justify-center gap-1.5 text-muted text-xs">
                        <Search className="h-6 w-6 text-muted/60" />
                        <span>Katalog kosong atau pencarian tidak cocok.</span>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-card-bg border-b border-card-border z-10">
                          <tr>
                            <th 
                              onClick={() => handleSort("ID")}
                              className="px-4 py-3 font-semibold text-muted uppercase tracking-wider w-20 cursor-pointer hover:bg-table-hover hover:text-foreground select-none transition-colors"
                            >
                              <div className="flex items-center gap-1">
                                ID
                                {sortCol === "ID" && (sortDesc ? <ChevronDown className="h-3 w-3 text-primary" /> : <ChevronUp className="h-3 w-3 text-primary" />)}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleSort("Judul")}
                              className="px-4 py-3 font-semibold text-muted uppercase tracking-wider cursor-pointer hover:bg-table-hover hover:text-foreground select-none transition-colors"
                            >
                              <div className="flex items-center gap-1">
                                Judul Komik
                                {sortCol === "Judul" && (sortDesc ? <ChevronDown className="h-3 w-3 text-primary" /> : <ChevronUp className="h-3 w-3 text-primary" />)}
                              </div>
                            </th>
                            <th 
                              onClick={() => handleSort("Genre")}
                              className="px-4 py-3 font-semibold text-muted uppercase tracking-wider w-28 cursor-pointer hover:bg-table-hover hover:text-foreground select-none transition-colors"
                            >
                              <div className="flex items-center gap-1">
                                Genre
                                {sortCol === "Genre" && (sortDesc ? <ChevronDown className="h-3 w-3 text-primary" /> : <ChevronUp className="h-3 w-3 text-primary" />)}
                              </div>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCatalog.map((comic) => (
                            <tr 
                              key={comic.title_no}
                              onClick={() => handleComicSelect(comic)}
                              className={`hover:bg-table-hover cursor-pointer transition-colors group ${webtoonInfo?.title_no === comic.title_no ? "bg-table-selected text-table-selected-text font-bold" : ""}`}
                            >
                              <td className="px-4 py-3 font-mono text-muted group-hover:text-foreground">{comic.title_no}</td>
                              <td className="px-4 py-3 font-medium text-foreground group-hover:text-primary truncate max-w-[200px]">{comic.title}</td>
                              <td className="px-4 py-3 text-muted truncate group-hover:text-foreground">{comic.genre}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>

              <footer className="p-3 bg-panel-bg border-t border-card-border flex justify-between text-xs text-muted flex-shrink-0">
                <span>Total Katalog: {catalog.length} komik</span>
                <span>Ditampilkan: {filteredCatalog.length}</span>
              </footer>
            </>
          )}
        </section>

        <section className="lg:col-span-7 flex flex-col h-full min-h-0 bg-background/40 backdrop-blur overflow-hidden">
          <div className="px-4 py-3 border-b border-card-border bg-panel-bg flex-shrink-0">
            <div className="flex gap-2 items-center">
              <input 
                type="text" 
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Masukkan URL atau ID Webtoon..."
                className="flex-1 bg-input-bg border border-input-border rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
              />
              <button 
                onClick={() => handleCheckInfo()}
                disabled={infoLoading || isDownloading}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover active:scale-95 text-xs font-bold text-white transition-all disabled:opacity-50 shadow-sm cursor-pointer whitespace-nowrap"
              >
                {infoLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Cek Info
              </button>
            </div>
          </div>

          {webtoonInfo && (
            <div className="mx-4 mt-3 mb-1 flex-shrink-0">
              <div className="flex gap-3 items-stretch p-3 rounded-xl border border-card-border bg-card-bg/80 backdrop-blur-sm shadow-sm">
                {webtoonInfo.cover_url ? (
                  <div className="w-[52px] h-[72px] flex-shrink-0 rounded-lg overflow-hidden border border-card-border shadow bg-panel-bg group">
                    <img 
                      src={webtoonInfo.cover_url} 
                      alt={webtoonInfo.title} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                ) : (
                  <div className="w-[52px] h-[72px] flex-shrink-0 rounded-lg bg-panel-bg border border-card-border flex flex-col items-center justify-center text-muted">
                    <BookOpen className="h-4 w-4 text-muted/40" />
                  </div>
                )}

                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[13px] font-bold text-primary truncate leading-tight">{webtoonInfo.title}</h3>
                    <button 
                      onClick={handleExportMetadataJson}
                      type="button"
                      disabled={infoLoading || episodes.length === 0}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-panel-bg border border-card-border hover:bg-table-hover active:scale-95 text-[10px] font-semibold text-muted hover:text-foreground transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex-shrink-0"
                      title="Export JSON"
                    >
                      <Download className="h-3 w-3" />
                      JSON
                    </button>
                  </div>
                  {webtoonInfo.author && (
                    <span className="text-[10px] text-muted truncate">by {webtoonInfo.author}</span>
                  )}
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    <span className="px-1.5 py-px rounded bg-panel-bg border border-card-border text-[9px] font-semibold text-foreground">{webtoonInfo.lang.toUpperCase()}</span>
                    <span className="px-1.5 py-px rounded bg-panel-bg border border-card-border text-[9px] font-semibold text-foreground capitalize">{webtoonInfo.genre}</span>
                    {webtoonInfo.status && (
                      <span className={`px-1.5 py-px rounded border text-[9px] font-semibold ${
                        webtoonInfo.status === "Completed" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-sky-500/10 border-sky-500/20 text-primary"
                      }`}>{webtoonInfo.status}</span>
                    )}
                    {webtoonInfo.rating && (
                      <span className="px-1.5 py-px rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-bold">★ {webtoonInfo.rating}</span>
                    )}
                    <span className="px-1.5 py-px rounded bg-panel-bg border border-card-border text-[9px] font-medium text-muted">
                      {episodes.length} ep{episodes.length > 0 ? ` (${episodes[0]?.episode_no}–${episodes[episodes.length-1]?.episode_no})` : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex-shrink-0">
            <button
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider hover:text-foreground transition-colors cursor-pointer"
            >
              <span>Download Settings</span>
              {showConfigPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            <div className={`relative z-20 transition-all duration-200 ease-in-out ${showConfigPanel ? "opacity-100 overflow-visible" : "max-h-0 opacity-0 overflow-hidden"}`}>
              <div className="px-4 pb-3 flex flex-col gap-2.5">
                <div className="flex gap-2 items-end">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Image</span>
                    <div className="flex bg-panel-bg border border-card-border p-0.5 rounded-lg">
                      {["WEBP", "JPEG", "PNG"].map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setImageFormat(fmt as any)}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${imageFormat === fmt ? "bg-primary text-white shadow-sm" : "text-muted hover:text-foreground"}`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Export</span>
                    <div className="relative">
                      <button 
                        type="button"
                        onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                        className="w-full bg-input-bg border border-input-border rounded-lg px-2.5 py-1 text-[10px] text-foreground flex items-center justify-between cursor-pointer focus:outline-none focus:border-primary transition-all"
                      >
                        <span className="truncate">{
                          exportType === "folder" ? "Folder" :
                          exportType === "cbz" ? "CBZ" :
                          exportType === "pdf" ? "PDF" :
                          exportType === "folder+cbz" ? "Folder+CBZ" :
                          "Folder+PDF"
                        }</span>
                        <ChevronDown className="h-3 w-3 text-muted flex-shrink-0 ml-1" />
                      </button>
                      {exportDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-45" onClick={() => setExportDropdownOpen(false)} />
                          <div className="absolute left-0 mt-1 w-full bg-card-bg border border-card-border rounded-lg shadow-xl z-50 py-1 overflow-hidden min-w-[180px]">
                            {[
                              { value: "folder", label: "Folder Gambar" },
                              { value: "cbz", label: "CBZ (Comic Book Zip)" },
                              { value: "pdf", label: "PDF (Dokumen)" },
                              { value: "folder+cbz", label: "Folder + CBZ" },
                              { value: "folder+pdf", label: "Folder + PDF" }
                            ].map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setExportType(opt.value as any);
                                  setExportDropdownOpen(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 text-[10px] transition-colors hover:bg-table-hover ${
                                  exportType === opt.value ? "bg-table-selected text-table-selected-text font-bold" : "text-foreground"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 w-28 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Threads</span>
                      <span className="text-[10px] font-bold text-primary">{threadCount}</span>
                    </div>
                    <input 
                      type="range" min="1" max="10"
                      value={threadCount}
                      onChange={(e) => setThreadCount(parseInt(e.target.value, 10))}
                      className="h-1 bg-panel-bg border border-card-border rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>

                {(exportType === "cbz" || exportType === "pdf") && (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none -mt-1">
                    <input 
                      type="checkbox"
                      checked={deleteFolderAfterExport}
                      onChange={(e) => setDeleteFolderAfterExport(e.target.checked)}
                      className="rounded border-input-border text-primary focus:ring-primary/20 h-3 w-3"
                    />
                    <span className="text-[10px] text-muted font-medium">Delete image folder after export</span>
                  </label>
                )}

                <div className="flex gap-2 items-end">
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Save to</span>
                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={outputDir}
                        onChange={(e) => setOutputDir(e.target.value)}
                        placeholder="Save directory..."
                        className="flex-1 bg-input-bg border border-input-border rounded-lg px-2.5 py-1 text-[10px] text-foreground placeholder-muted focus:outline-none focus:border-primary transition-all min-w-0"
                      />
                      <button 
                        onClick={handleBrowseFolder}
                        type="button"
                        className="px-2 py-1 rounded-lg bg-card-bg border border-card-border text-muted hover:text-foreground hover:bg-table-hover active:scale-95 transition-all cursor-pointer"
                        title="Browse"
                      >
                        <Folder className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Chapters</span>
                    <div className="flex gap-1">
                      <div className="relative flex-1 min-w-0">
                        <button 
                          type="button"
                          onClick={() => setChapterDropdownOpen(!chapterDropdownOpen)}
                          className="w-full bg-input-bg border border-input-border rounded-lg px-2.5 py-1 text-[10px] text-foreground flex items-center justify-between cursor-pointer focus:outline-none focus:border-primary transition-all"
                        >
                          <span className="truncate">{
                            chapterSelectionMode === "all" ? "All Chapters" :
                            chapterSelectionMode === "latest" ? "Latest" :
                            chapterSelectionMode === "range" ? "Range" :
                            chapterSelectionMode === "specific" ? "Specific" :
                            "Custom"
                          }</span>
                          <ChevronDown className="h-3 w-3 text-muted flex-shrink-0 ml-1" />
                        </button>
                        {chapterDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-45" onClick={() => setChapterDropdownOpen(false)} />
                            <div className="absolute left-0 mt-1 w-full bg-card-bg border border-card-border rounded-lg shadow-xl z-50 py-1 overflow-hidden min-w-[150px]">
                              {[
                                { value: "all", label: "All Chapters" },
                                { value: "latest", label: "Latest Chapter" },
                                { value: "range", label: "Range" },
                                { value: "specific", label: "Specific" },
                                { value: "custom", label: "Custom Picker" }
                              ].map(opt => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setChapterSelectionMode(opt.value as any);
                                    setChapterDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-1.5 text-[10px] transition-colors hover:bg-table-hover ${
                                    chapterSelectionMode === opt.value ? "bg-table-selected text-table-selected-text font-bold" : "text-foreground"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {chapterSelectionMode === "range" && (
                        <div className="flex items-center gap-1">
                          <NumberInput placeholder="From" value={chapterStart} onChange={setChapterStart} />
                          <span className="text-muted text-[9px]">–</span>
                          <NumberInput placeholder="To" value={chapterEnd} onChange={setChapterEnd} />
                        </div>
                      )}

                      {chapterSelectionMode === "specific" && (
                        <input 
                          type="text"
                          placeholder="1, 3, 5..."
                          value={chapterSpecificList}
                          onChange={(e) => setChapterSpecificList(e.target.value)}
                          className="flex-1 bg-input-bg border border-input-border rounded-lg px-2.5 py-1 text-[10px] text-foreground placeholder-muted focus:outline-none focus:border-primary transition-all min-w-0"
                        />
                      )}

                      {chapterSelectionMode === "custom" && (
                        <button 
                          type="button"
                          onClick={() => setShowCustomChapterModal(true)}
                          className="px-2.5 py-1 bg-input-bg border border-input-border hover:bg-table-hover rounded-lg text-[10px] font-bold text-primary flex items-center gap-1 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                        >
                          <Settings className="h-3 w-3" />
                          {selectedCustomChapters.length} sel.
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-card-border flex-shrink-0" />

          <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
            <div className="flex items-center gap-3 mb-2 flex-shrink-0">
              <span className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide flex-shrink-0 ${
                downloadStatus === "Idle" ? "bg-card-bg border-card-border text-muted" :
                downloadStatus === "Downloading" ? "bg-sky-500/10 border-sky-500/20 text-primary animate-pulse" :
                downloadStatus === "Completed" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                downloadStatus === "Cancelled" || downloadStatus === "Cancelling" ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                "bg-rose-500/10 border-rose-500/20 text-rose-500"
              }`}>
                {downloadStatus}
              </span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="flex-1 h-1.5 bg-card-bg rounded-full overflow-hidden border border-card-border/50">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted font-mono flex-shrink-0">{downloadProgress.current}/{downloadProgress.total}</span>
              </div>
            </div>

            <div className="flex-1 min-h-0 border border-card-border bg-terminal-bg rounded-xl p-3 font-mono text-[11px] overflow-y-auto flex flex-col gap-1 text-zinc-300 shadow-inner relative group">
              {logs.length === 0 ? (
                <div className="m-auto flex flex-col items-center gap-1.5 text-zinc-600 select-none">
                  <FileText className="h-5 w-5" />
                  <p className="text-[10px]">Terminal siap. Log operasi akan muncul di sini.</p>
                </div>
              ) : (
                logs.map((log, index) => {
                  let colorClass = "text-zinc-400";
                  if (log.includes("[Error]")) colorClass = "text-rose-400";
                  else if (log.includes("[Warning]")) colorClass = "text-amber-400";
                  else if (log.includes("[Sukses]") || log.includes("Selesai!")) colorClass = "text-emerald-400";
                  else if (log.includes("=== MEMUAT") || log.includes("MEMULAI UNDUHAN")) colorClass = "text-sky-400 font-bold";
                  
                  return (
                    <div key={index} className={`whitespace-pre-wrap leading-relaxed ${colorClass}`}>
                      {log}
                    </div>
                  );
                })
              )}
              <div ref={logEndRef} />
              {logs.length > 0 && (
                <button 
                  onClick={() => setLogs([])}
                  className="absolute right-3 top-3 p-1 rounded-md bg-zinc-800/80 border border-zinc-700 hover:bg-zinc-700 hover:text-white transition-all text-zinc-500 opacity-0 group-hover:opacity-100"
                  title="Clear Log"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="mt-3 flex gap-2 flex-shrink-0">
              <button 
                onClick={handleStartDownload}
                type="button"
                disabled={isDownloading || !webtoonInfo || episodes.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <Download className="h-4 w-4" />
                Start Download
              </button>
              
              <button 
                onClick={handleAddToQueue}
                type="button"
                disabled={!webtoonInfo || episodes.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-card-border bg-card-bg hover:bg-table-hover text-foreground active:scale-[0.98] text-xs font-bold transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                Add to Queue
              </button>
              
              <button 
                onClick={handleCancelDownload}
                type="button"
                disabled={!isDownloading || downloadStatus === "Cancelling"}
                className="px-4 py-2.5 rounded-xl border border-card-border bg-card-bg text-muted hover:text-foreground hover:bg-table-hover active:scale-[0.98] text-xs font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      </div>

      {showCustomChapterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card-bg border border-card-border rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-card-border bg-panel-bg flex items-center justify-between flex-shrink-0">
              <div className="flex flex-col">
                <h3 className="text-sm font-bold text-foreground">Pilih Custom Chapter</h3>
                <span className="text-[10px] text-muted font-medium">{episodes.length} chapter tersedia</span>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedCustomChapters(episodes.map(ep => ep.episode_no));
                  }}
                  className="text-[10px] font-semibold text-primary hover:underline"
                >
                  Pilih Semua
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedCustomChapters([]);
                  }}
                  className="text-[10px] font-semibold text-rose-500 hover:underline"
                >
                  Hapus Semua
                </button>
                <button 
                  type="button"
                  onClick={() => setShowCustomChapterModal(false)}
                  className="p-1.5 rounded-lg bg-card-bg border border-card-border hover:bg-table-hover text-muted hover:text-foreground active:scale-90 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 min-h-0 bg-background/50">
              {episodes.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-1.5 text-muted text-xs">
                  <Info className="h-6 w-6" />
                  <span>Silakan Cek Info komik terlebih dahulu untuk memuat daftar chapter.</span>
                </div>
              ) : (
                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                  {episodes.map((ep) => {
                    const isSelected = selectedCustomChapters.includes(ep.episode_no);
                    const label = ep.ch_num || String(ep.episode_no);
                    return (
                      <button
                        key={ep.episode_no}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCustomChapters(prev => prev.filter(id => id !== ep.episode_no));
                          } else {
                            setSelectedCustomChapters(prev => [...prev, ep.episode_no]);
                          }
                        }}
                        className={`aspect-square rounded-xl border flex flex-col items-center justify-center p-1 text-[11px] font-bold transition-all active:scale-90 cursor-pointer ${
                          isSelected 
                            ? "bg-primary border-primary text-white shadow-md shadow-primary/20 scale-105" 
                            : "bg-card-bg border-card-border text-muted hover:text-foreground hover:bg-table-hover"
                        }`}
                        title={ep.title}
                      >
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="px-5 py-4 border-t border-card-border bg-panel-bg flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-muted font-medium">
                {selectedCustomChapters.length} chapter dipilih untuk diunduh
              </span>
              <button 
                type="button"
                onClick={() => setShowCustomChapterModal(false)}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover active:scale-95 text-xs font-bold text-white transition-all shadow-md shadow-primary/10"
              >
                Konfirmasi Pilihan
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
