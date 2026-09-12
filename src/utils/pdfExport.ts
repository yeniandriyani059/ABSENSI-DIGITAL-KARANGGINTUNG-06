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
