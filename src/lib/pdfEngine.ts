import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import JSZip from 'jszip';
import { CertificateTemplate, FieldConfig, RecipientRecord } from '../types/certificate';

/**
 * Standard reference width used across Preview DOM, High-Res Canvas, and Vector PDF.
 * At 1200px reference width, a 36pt font represents 36/1200 = 3% of certificate width.
 * By using this reference in all render targets, font scaling is 100% mathematically identical.
 */
export const REFERENCE_BASE_WIDTH = 1200;

// Helper to convert hex color (#1e293b) to RGB normalized 0..1
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 0.1, g: 0.1, b: 0.1 };
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

// Convert data URL (including SVG) to Uint8Array image bytes (PNG/JPEG)
export async function dataUrlToImageBytes(dataUrl: string): Promise<{ bytes: Uint8Array; isPng: boolean }> {
  if (dataUrl.startsWith('data:image/svg+xml') || dataUrl.includes('<svg')) {
    const pngDataUrl = await rasterizeSvgToPngDataUrl(dataUrl);
    return extractBase64Bytes(pngDataUrl);
  }
  return extractBase64Bytes(dataUrl);
}

// Helper to convert SVG data URL to PNG data URL using offscreen canvas
export function rasterizeSvgToPngDataUrl(svgDataUrl: string, targetWidth = 1920, targetHeight = 1080): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      const url = canvas.toDataURL('image/png', 0.95);
      // Clean up canvas
      canvas.width = 0;
      canvas.height = 0;
      resolve(url);
    };
    img.onerror = (e) => reject(new Error('Failed to load SVG template for rasterization: ' + e));
    img.src = svgDataUrl;
  });
}

function extractBase64Bytes(dataUrl: string): { bytes: Uint8Array; isPng: boolean } {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const isPng = mime.includes('png');
  const base64 = parts[1];
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return { bytes, isPng };
}

// Format text according to transform rule
export function formatText(value: string, transform: 'none' | 'uppercase' | 'capitalize'): string {
  if (!value) return '';
  if (transform === 'uppercase') return value.toUpperCase();
  if (transform === 'capitalize') {
    return value.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return value;
}

// Choose standard font for PDF
async function resolvePdfFont(
  pdfDoc: PDFDocument,
  family: 'Helvetica' | 'TimesRoman' | 'Courier',
  isBold: boolean,
  isItalic: boolean
): Promise<PDFFont> {
  if (family === 'TimesRoman') {
    if (isBold && isItalic) return pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
    if (isBold) return pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    if (isItalic) return pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    return pdfDoc.embedFont(StandardFonts.TimesRoman);
  }
  if (family === 'Courier') {
    if (isBold && isItalic) return pdfDoc.embedFont(StandardFonts.CourierBoldOblique);
    if (isBold) return pdfDoc.embedFont(StandardFonts.CourierBold);
    if (isItalic) return pdfDoc.embedFont(StandardFonts.CourierOblique);
    return pdfDoc.embedFont(StandardFonts.Courier);
  }
  // Default: Helvetica
  if (isBold && isItalic) return pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
  if (isBold) return pdfDoc.embedFont(StandardFonts.HelveticaBold);
  if (isItalic) return pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  return pdfDoc.embedFont(StandardFonts.Helvetica);
}

/**
 * Generate single certificate PDF with exact 1:1 proportional scaling matching the DOM preview.
 * Math: fontSizeInPdf = field.fontSize * (pageWidth / REFERENCE_BASE_WIDTH)
 */
export async function generateSingleCertificatePdf(
  template: CertificateTemplate,
  fields: FieldConfig[],
  recipientData: Record<string, string>
): Promise<Blob> {
  let pdfDoc: PDFDocument;
  let page: any;

  if (template.type === 'pdf') {
    const { bytes } = extractBase64Bytes(template.dataUrl);
    const sourcePdf = await PDFDocument.load(bytes);
    pdfDoc = await PDFDocument.create();
    const pageIndex = Math.max(0, Math.min(template.pageNumber - 1, sourcePdf.getPageCount() - 1));
    const [copiedPage] = await pdfDoc.copyPages(sourcePdf, [pageIndex]);
    page = pdfDoc.addPage(copiedPage);
  } else {
    // Image or rasterized SVG
    const { bytes, isPng } = await dataUrlToImageBytes(template.dataUrl);
    pdfDoc = await PDFDocument.create();
    const embeddedImg = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: embeddedImg.width,
      height: embeddedImg.height,
    });
  }

  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  // Dynamic Scale Multiplier:
  // Base coordinate width is derived directly from the template's canonical width (matching DOM preview)
  const baseWidth = template.width || pageWidth || REFERENCE_BASE_WIDTH;
  const pdfScale = pageWidth / baseWidth;

  for (const field of fields) {
    let rawText = '';
    if (field.mappedColumn && recipientData[field.mappedColumn] !== undefined) {
      rawText = String(recipientData[field.mappedColumn] || '');
    } else {
      rawText = field.sampleValue || '';
    }

    const text = formatText(rawText, field.textTransform);
    if (!text) continue;

    const font = await resolvePdfFont(pdfDoc, field.fontFamily, field.isBold, field.isItalic);
    const boxX = (field.xPercent / 100) * pageWidth;
    const boxWidth = (field.widthPercent / 100) * pageWidth;

    // Apply exact proportional font sizing
    let fontSize = field.fontSize * pdfScale;
    let textWidth = font.widthOfTextAtSize(text, fontSize);

    // Dynamic shrink to fit if text exceeds container
    if (field.autoScale && textWidth > boxWidth && boxWidth > 10) {
      const scale = boxWidth / textWidth;
      fontSize = Math.max(8 * pdfScale, fontSize * scale);
      textWidth = font.widthOfTextAtSize(text, fontSize);
    }

    let drawX = boxX;
    if (field.textAlign === 'center') {
      drawX = boxX + (boxWidth - textWidth) / 2;
    } else if (field.textAlign === 'right') {
      drawX = boxX + boxWidth - textWidth;
    }

    // PDF Y coordinates count from bottom-left; center-align matches CSS -translate-y-1/2 exactly
    const centerYFromBottom = pageHeight - ((field.yPercent / 100) * pageHeight);
    const drawY = centerYFromBottom - (fontSize * 0.35);
    const { r, g, b } = hexToRgb(field.fontColor);

    page.drawText(text, {
      x: drawX,
      y: drawY,
      size: fontSize,
      font,
      color: rgb(r, g, b),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/**
 * Generate High-Resolution PNG Image of Certificate with exact 1:1 proportional scaling.
 * Math: dynamic scale multiplier (exportWidth / baseWidth) applied to font size and coordinates.
 */
export async function generateSingleCertificatePng(
  template: CertificateTemplate,
  fields: FieldConfig[],
  recipientData: Record<string, string>,
  targetWidth = 1920
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const naturalWidth = img.naturalWidth || template.width || 1200;
      const naturalHeight = img.naturalHeight || template.height || 850;
      const exportWidth = targetWidth || naturalWidth;
      const exportHeight = Math.round(exportWidth * (naturalHeight / naturalWidth));

      const canvas = document.createElement('canvas');
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportWidth, exportHeight);
      ctx.drawImage(img, 0, 0, exportWidth, exportHeight);

      // Base coordinate width matching the editor preview
      const baseWidth = template.width || REFERENCE_BASE_WIDTH;
      // Dynamic scaling multiplier (exportWidth / baseWidth)
      const canvasScale = exportWidth / baseWidth;

      fields.forEach((field) => {
        let rawText = '';
        if (field.mappedColumn && recipientData[field.mappedColumn] !== undefined) {
          rawText = String(recipientData[field.mappedColumn] || '');
        } else {
          rawText = field.sampleValue || '';
        }

        const text = formatText(rawText, field.textTransform);
        if (!text) return;

        const boxX = (field.xPercent / 100) * exportWidth;
        const centerY = (field.yPercent / 100) * exportHeight;
        const boxWidth = (field.widthPercent / 100) * exportWidth;

        // Apply exact proportional font sizing
        let fontSize = field.fontSize * canvasScale;
        const cssFontFamily =
          field.fontFamily === 'TimesRoman'
            ? "'Times New Roman', Times, serif"
            : field.fontFamily === 'Courier'
            ? "'Courier New', Courier, monospace"
            : "sans-serif";

        const fontStyle = `${field.isItalic ? 'italic ' : ''}${field.isBold ? 'bold ' : ''}${fontSize}px ${cssFontFamily}`;
        ctx.font = fontStyle;
        ctx.fillStyle = field.fontColor || '#0f172a';
        // Middle baseline matches CSS transform -translate-y-1/2 on DOM preview exactly
        ctx.textBaseline = 'middle';

        let textWidth = ctx.measureText(text).width;
        if (field.autoScale && textWidth > boxWidth && boxWidth > 10) {
          const fontScale = boxWidth / textWidth;
          fontSize = Math.max(8 * canvasScale, fontSize * fontScale);
          ctx.font = `${field.isItalic ? 'italic ' : ''}${field.isBold ? 'bold ' : ''}${fontSize}px ${cssFontFamily}`;
          textWidth = ctx.measureText(text).width;
        }

        let drawX = boxX;
        if (field.textAlign === 'center') {
          ctx.textAlign = 'center';
          drawX = boxX + boxWidth / 2;
        } else if (field.textAlign === 'right') {
          ctx.textAlign = 'right';
          drawX = boxX + boxWidth;
        } else {
          ctx.textAlign = 'left';
        }

        ctx.fillText(text, drawX, centerY);
      });

      canvas.toBlob((blob) => {
        // Explicitly clean up canvas dimensions to free GPU memory
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate PNG blob'));
      }, 'image/png');
    };
    img.onerror = (e) => reject(new Error('Failed to load template image: ' + e));
    img.src = template.dataUrl;
  });
}

// Convert Blob to Base64 String for API attachments
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Generate standardized clean filename: e.g. "Rahul_Patil_CERT-001.pdf"
export function generateCertificateFileName(
  recipientData: Record<string, string>,
  projectName: string,
  index: number,
  extension = 'pdf'
): string {
  const nameKeys = ['Full Name', 'Name', 'fullName', 'Recipient Name', 'Student Name'];
  let foundName = '';
  for (const k of nameKeys) {
    if (recipientData[k]) {
      foundName = recipientData[k];
      break;
    }
  }

  const idKeys = ['Certificate ID', 'Cert ID', 'certId', 'ID', 'Serial No', 'Roll No'];
  let foundId = '';
  for (const k of idKeys) {
    if (recipientData[k]) {
      foundId = recipientData[k];
      break;
    }
  }

  const clean = (s: string) => s.trim().replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');

  let base = '';
  if (foundName && foundId) {
    base = `${clean(foundName)}_${clean(foundId)}`;
  } else if (foundName) {
    base = `${clean(foundName)}_CERT_${index + 1}`;
  } else if (foundId) {
    base = `Certificate_${clean(foundId)}`;
  } else {
    base = `${clean(projectName || 'Certificate')}_${index + 1}`;
  }

  return `${base}.${extension}`;
}

// Create Bulk ZIP containing all generated certificate PDFs with memory-friendly chunking
export async function createCertificatesZip(
  certificates: { fileName: string; blob: Blob }[],
  onProgress?: (percent: number, current: number, total: number) => void
): Promise<Blob> {
  const zip = new JSZip();

  const total = certificates.length;
  for (let i = 0; i < total; i++) {
    const item = certificates[i];
    zip.file(item.fileName, item.blob);
    if (onProgress && i % 5 === 0) {
      onProgress(Math.round(((i + 1) / total) * 50), i + 1, total);
      // Yield to event loop to avoid locking thread
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress) {
        const zipPercent = 50 + Math.round(metadata.percent / 2);
        onProgress(zipPercent, total, total);
      }
    }
  );
}

// Utility to trigger browser file download with immediate URL cleanup
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
