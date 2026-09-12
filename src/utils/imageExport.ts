import { toPng, toJpeg } from 'html-to-image';

/**
 * Exports a DOM element as a high-resolution PNG or JPEG image.
 * Uses html-to-image which natively supports modern CSS features such as oklch colors.
 */
export async function exportElementToImage(
  elementId: string,
  filename: string,
  options?: {
    format?: 'png' | 'jpeg';
    quality?: number;
    scale?: number;
    backgroundColor?: string | null;
  }
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Elemen #${elementId} tidak ditemukan untuk ekspor gambar.`);
  }

  // Temporarily make sure it's visible if hidden via class or style
  const hadHiddenClass = element.classList.contains('hidden');
  const originalDisplay = element.style.display;
  const originalPosition = element.style.position;
  const wasHidden = hadHiddenClass || window.getComputedStyle(element).display === 'none';

  if (hadHiddenClass) {
    element.classList.remove('hidden');
  }
  if (wasHidden) {
    element.style.display = 'block';
    element.style.position = 'relative';
  }

  try {
    const scale = options?.scale ?? 2.5; // High crisp DPI
    const format = options?.format ?? 'png';
    const quality = options?.quality ?? 0.95;
    const backgroundColor =
      options?.backgroundColor !== undefined && options.backgroundColor !== null
        ? options.backgroundColor
        : format === 'jpeg'
        ? '#ffffff'
        : undefined;

    let dataUrl: string;
    if (format === 'jpeg') {
      dataUrl = await toJpeg(element, {
        pixelRatio: scale,
        quality,
        backgroundColor: backgroundColor || '#ffffff',
        cacheBust: true,
        skipFonts: true,
      });
    } else {
      dataUrl = await toPng(element, {
        pixelRatio: scale,
        backgroundColor,
        cacheBust: true,
        skipFonts: true,
      });
    }

    const link = document.createElement('a');
    const extension = format === 'jpeg' ? '.jpg' : '.png';
    const safeFilename = filename.toLowerCase().endsWith(extension)
      ? filename
      : `${filename}${extension}`;

    link.href = dataUrl;
    link.download = safeFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    if (hadHiddenClass) {
      element.classList.add('hidden');
    }
    if (wasHidden) {
      element.style.display = originalDisplay;
      element.style.position = originalPosition;
    }
  }
}

/**
 * Resizes and compresses an uploaded image file into a compact base64 data URL
 * suitable for localStorage and ID card printing.
 */
export function compressAndResizeImage(
  file: File,
  maxWidth = 400,
  maxHeight = 500,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format berkas gambar tidak valid.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio fit
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Tidak dapat membuat konteks canvas gambar.'));
          return;
        }

        // Draw image onto canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to dataURL
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
