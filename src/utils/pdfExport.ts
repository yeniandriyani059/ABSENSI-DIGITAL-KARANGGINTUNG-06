import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

export async function exportElementToPdf(
  elementId: string,
  filename: string,
  options?: {
    orientation?: 'portrait' | 'landscape';
    format?: string;
    marginMm?: number;
  }
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found for PDF export.`);
  }

  // Temporarily make sure it's visible if hidden
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
    const imgData = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Gagal memuat gambar untuk pembuatan PDF.'));
      img.src = imgData;
    });

    const orientation = options?.orientation || 'portrait';
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: options?.format || 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = options?.marginMm ?? 8;

    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;

    const imgWidth = availableWidth;
    const imgHeight = (img.height * imgWidth) / img.width;

    let heightLeft = imgHeight;
    let position = margin;

    // First page
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= availableHeight;

    // Subsequent pages if long document
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= availableHeight;
    }

    pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
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
 * Exports multiple A4 card sheets into a clean multi-page PDF where each sheet (.print-card-sheet)
 * becomes an exact, unclipped A4 page. Perfect for iframe environments where window.print() is restricted.
 */
export async function exportCardsPagesToPdf(
  containerId: string,
  filename: string
): Promise<void> {
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Element #${containerId} tidak ditemukan untuk pembuatan PDF.`);
  }

  const hadHiddenClass = container.classList.contains('hidden');
  const originalDisplay = container.style.display;
  const originalPosition = container.style.position;
  const originalWidth = container.style.width;
  const wasHidden = hadHiddenClass || window.getComputedStyle(container).display === 'none';

  if (hadHiddenClass) {
    container.classList.remove('hidden');
  }
  if (wasHidden) {
    container.style.display = 'block';
    container.style.position = 'relative';
    container.style.width = '210mm';
  }

  try {
    const sheets = Array.from(container.querySelectorAll<HTMLElement>('.print-card-sheet'));
    if (sheets.length === 0) {
      // Fallback to standard export
      await exportElementToPdf(containerId, filename, {
        orientation: 'portrait',
        format: 'a4',
        marginMm: 6,
      });
      return;
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      const imgData = await toPng(sheet, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      // Add image filling A4 page nicely
      pdf.addImage(imgData, 'PNG', 5, 5, pageWidth - 10, pageHeight - 10, undefined, 'FAST');
    }

    const safeFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeFilename);
  } finally {
    if (hadHiddenClass) {
      container.classList.add('hidden');
    }
    if (wasHidden) {
      container.style.display = originalDisplay;
      container.style.position = originalPosition;
      container.style.width = originalWidth;
    }
  }
}
