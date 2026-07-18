# UniScraper Desktop 🎨

A modern, fast, and feature-rich **LINE Webtoon Downloader & Image Converter** built with **Next.js 16**, **Tailwind CSS v4**, and **Tauri v2**.

## 🌟 Key Features

- 📚 **Full Webtoon Catalog Browser**: Browse and search thousands of Webtoons in Indonesian (`id`) and English (`en`).
- ⚡ **Multi-Threaded Downloader**: Parallel image downloading with custom thread worker limits (1–10 threads).
- 🖼️ **Image Format Conversion**: Convert chapters to **WEBP**, **JPEG**, or **PNG** on the fly.
- 📦 **Export Formats**: Support exporting to **Folder**, **CBZ (Comic Book Zip)**, or **PDF** documents.
- 📋 **Download Queue Manager**: Batch queue multiple Webtoons and chapters for automatic processing.
- 📑 **ComicInfo.xml Generation**: Automatically generates metadata for comic readers (Tachiyomi, YACReader, Kusamochi, etc.).
- 🎨 **Modern Clean UI**: Compact collapsible settings, cover image previews, theme switching, and live terminal logs.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (v18 or higher)
- [Rust](https://www.rust-lang.org) (for Tauri desktop builds)

### Development
```bash
npm install
npm run dev
```

### Desktop App Build (Tauri)
```bash
npx @tauri-apps/cli build
```

## 📜 License
MIT License. Created by [Stillalv](https://github.com/Stillalv).
