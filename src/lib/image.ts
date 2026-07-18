export function detectImageFormat(bytes: Uint8Array): "WEBP" | "JPEG" | "PNG" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return "PNG";
  }
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return "JPEG";
  }
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "WEBP";
  }
  return null;
}

export async function convertImage(bytes: Uint8Array, mimeType: string, quality: number = 0.9): Promise<Uint8Array> {
  const blob = new Blob([bytes] as BlobPart[]);
  const url = URL.createObjectURL(blob);
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Gagal mengambil Canvas 2D context."));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((convertedBlob) => {
        if (!convertedBlob) {
          reject(new Error("Gagal melakukan konversi gambar di canvas."));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            resolve(new Uint8Array(reader.result as ArrayBuffer));
          } else {
            reject(new Error("Gagal membaca hasil konversi gambar."));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(convertedBlob);
      }, mimeType, quality);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
