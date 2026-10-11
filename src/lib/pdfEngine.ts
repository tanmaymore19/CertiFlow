import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import JSZip from 'jszip';
import { CertificateTemplate, FieldConfig, RecipientRecord } from '../types/certificate';

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
      resolve(canvas.toDataURL('image/png', 0.95));
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
function formatText(value: string, transform: 'none' | 'uppercase' | 'capitalize'): string {
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
 * Generate single certificate PDF with mathematically exact 1:1 proportional scaling.
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
    const boxYTop = (field.yPercent / 100) * pageHeight;
    const boxWidth = (field.widthPercent / 100) * pageWidth;

    let fontSize = field.fontSize;
    let textWidth = font.widthOfTextAtSize(text, fontSize);

    // Dynamic shrink to fit if text exceeds container
    if (field.autoScale && textWidth > boxWidth && boxWidth > 10) {
      const scale = boxWidth / textWidth;
      fontSize = Math.max(8, fontSize * scale);
      textWidth = font.widthOfTextAtSize(text, fontSize);
    }

    let drawX = boxX;
    if (field.textAlign === 'center') {
      drawX = boxX + (boxWidth - textWidth) / 2;
    } else if (field.textAlign === 'right') {
      drawX = boxX + boxWidth - textWidth;
    }

    // PDF Y coordinates count from bottom-left
    const drawY = pageHeight - boxYTop - fontSize;
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
 * Generate High-Resolution PNG Image of Certificate for 1:1 Canvas Export.
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
      const canvas = document.createElement('canvas');
      const targetHeight = Math.round(targetWidth * (img.naturalHeight / img.naturalWidth || 0.707));
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Scale factor relative to reference template width
      const refWidth = template.width || 1200;
      const scale = targetWidth / refWidth;

      fields.forEach((field) => {
        let rawText = '';
        if (field.mappedColumn && recipientData[field.mappedColumn] !== undefined) {
          rawText = String(recipientData[field.mappedColumn] || '');
        } else {
          rawText = field.sampleValue || '';
        }

        const text = formatText(rawText, field.textTransform);
        if (!text) return;

        const boxX = (field.xPercent / 100) * targetWidth;
        const boxY = (field.yPercent / 100) * targetHeight;
        const boxWidth = (field.widthPercent / 100) * targetWidth;

        let fontSize = field.fontSize * scale;
        const cssFontFamily =
          field.fontFamily === 'TimesRoman'
            ? "'Times New Roman', Times, serif"
            : field.fontFamily === 'Courier'
            ? "'Courier New', Courier, monospace"
            : "sans-serif";

        const fontStyle = `${field.isItalic ? 'italic ' : ''}${field.isBold ? 'bold ' : ''}${fontSize}px ${cssFontFamily}`;
        ctx.font = fontStyle;
        ctx.fillStyle = field.fontColor || '#0f172a';
        ctx.textBaseline = 'top';

        let textWidth = ctx.measureText(text).width;
        if (field.autoScale && textWidth > boxWidth && boxWidth > 10) {
          const fontScale = boxWidth / textWidth;
          fontSize = Math.max(12, fontSize * fontScale);
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

        ctx.fillText(text, drawX, boxY);
      });

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate PNG blob'));
      }, 'image/png');
    };
    img.onerror = (e) => reject(new Error('Failed to load template image: ' + e));
    img.src = template.dataUrl;
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

// Create Bulk ZIP containing all generated certificate PDFs
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

// Utility to trigger browser file download
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
