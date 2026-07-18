import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "id,en-US;q=0.9,en;q=0.8"
};

export async function fetchText(url: string, referer?: string): Promise<string> {
  const headers: Record<string, string> = { ...HEADERS };
  if (referer) {
    headers["Referer"] = referer;
  }
  
  try {
    const res = await tauriFetch(url, { method: "GET", headers });
    return await res.text();
  } catch (e) {
    const res = await fetch(url, { headers });
    return await res.text();
  }
}

export async function fetchBinary(url: string, referer?: string): Promise<Uint8Array> {
  const headers: Record<string, string> = { ...HEADERS };
  if (referer) {
    headers["Referer"] = referer;
  }
  
  try {
    const res = await tauriFetch(url, { method: "GET", headers });
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (e) {
    const res = await fetch(url, { headers });
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  }
}
