import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { CertificateTemplate } from '../types/certificate';

// Set up PDF.js worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  // Use official CDN worker matching version for Vite environment compatibility
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
}

// Render a specific page of a PDF bytes array to a high-resolution PNG Data URL
export async function renderPdfPageToDataUrl(pdfBytes: Uint8Array, pageNumber = 1, scale = 1.5): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const pageIndex = Math.max(1, Math.min(pageNumber, pdf.numPages));
    const page = await pdf.getPage(pageIndex);

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas 2D context not available');
    }

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas,
    } as any).promise;

    return canvas.toDataURL('image/png', 0.95);
  } catch (err) {
    console.warn('PDF.js canvas render fallback:', err);
    // Return empty or fallback
    throw err;
  }
}

// Process uploaded File (PDF, PNG, JPG/JPEG) into CertificateTemplate
export async function processTemplateFile(file: File): Promise<CertificateTemplate> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(file.name);

  if (!isPdf && !isImage) {
    throw new Error('Unsupported template format. Please upload a PDF, PNG, or JPG/JPEG image.');
  }

  // Max 25MB check
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Template file exceeds the 25MB size limit. Please upload an optimized file.');
  }

  if (isPdf) {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const pdfDoc = await PDFDocument.load(bytes);
    const pageCount = pdfDoc.getPageCount();
    if (pageCount === 0) {
      throw new Error('The uploaded PDF has no pages.');
    }

    const firstPage = pdfDoc.getPage(0);
    const width = Math.round(firstPage.getWidth());
    const height = Math.round(firstPage.getHeight());
    const orientation = width >= height ? 'landscape' : 'portrait';

    // Render page 1 preview to data URL
    let previewDataUrl = '';
    try {
      previewDataUrl = await renderPdfPageToDataUrl(bytes, 1);
    } catch {
      // If pdfjs fails to render to canvas, store PDF as base64 data url directly
      const base64 = btoa(
        bytes.reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      previewDataUrl = `data:application/pdf;base64,${base64}`;
    }

    // Convert full PDF to base64 dataUrl so pdf-lib can copy original vector pages
    const base64 = btoa(
      bytes.reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const pdfDataUrl = `data:application/pdf;base64,${base64}`;

    return {
      name: file.name,
      type: 'pdf',
      mimeType: file.type || 'application/pdf',
      dataUrl: pdfDataUrl,
      pageNumber: 1,
      pageCount,
      width,
      height,
      orientation,
    };
  }

  // Handle PNG / JPG / JPEG
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || 1200;
        const height = img.naturalHeight || 850;
        const orientation = width >= height ? 'landscape' : 'portrait';
        resolve({
          name: file.name,
          type: 'image',
          mimeType: file.type || 'image/png',
          dataUrl,
          pageNumber: 1,
          pageCount: 1,
          width,
          height,
          orientation,
        });
      };
      img.onerror = () => reject(new Error('Corrupted or unreadable image file.'));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Failed to read file from disk.'));
    reader.readAsDataURL(file);
  });
}
