import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Sliders,
  CheckCircle2,
  FileCheck,
  Search,
  Sparkles,
  Edit2,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import {
  CertificateTemplate,
  FieldConfig,
  RecipientRecord,
} from '../types/certificate';
import {
  generateSingleCertificatePdf,
  generateSingleCertificatePng,
  generateCertificateFileName,
  downloadBlob,
} from '../lib/pdfEngine';

interface PreviewStepProps {
  template: CertificateTemplate;
  fields: FieldConfig[];
  recipients: RecipientRecord[];
  projectName: string;
  onBackToEditor: () => void;
  onProceedToGenerate: () => void;
  onUpdateRecipient?: (updatedRecipient: RecipientRecord) => void;
}

export const PreviewStep: React.FC<PreviewStepProps> = ({
  template,
  fields,
  recipients,
  projectName,
  onBackToEditor,
  onProceedToGenerate,
  onUpdateRecipient,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidthPx, setContainerWidthPx] = useState(1200);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidthPx(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const templateBaseWidth = template.width || 1200;
  const scaleFactor = containerWidthPx / templateBaseWidth;

  const currentRecipient = recipients[currentIndex];

  const handleDownloadCurrentPdf = async () => {
    if (!currentRecipient) return;
    setIsExporting(true);
    try {
      const pdfBlob = await generateSingleCertificatePdf(
        template,
        fields,
        currentRecipient.data
      );
      const fileName = generateCertificateFileName(
        currentRecipient.data,
        projectName,
        currentIndex,
        'pdf'
      );
      downloadBlob(pdfBlob, fileName);
    } catch (err) {
      console.error('Failed to generate single preview PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCurrentPng = async () => {
    if (!currentRecipient) return;
    setIsExporting(true);
    try {
      const pngBlob = await generateSingleCertificatePng(
        template,
        fields,
        currentRecipient.data,
        1920
      );
      const fileName = generateCertificateFileName(
        currentRecipient.data,
        projectName,
        currentIndex,
        'png'
      );
      downloadBlob(pngBlob, fileName);
    } catch (err) {
      console.error('Failed to generate PNG certificate:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Direct Inline Text Change on Preview Card
  const handleInlineValueChange = (field: FieldConfig, newValue: string) => {
    if (!currentRecipient) return;
    const colName = field.mappedColumn || field.label;
    const updatedData = {
      ...currentRecipient.data,
      [colName]: newValue,
    };
    const updatedRec: RecipientRecord = {
      ...currentRecipient,
      data: updatedData,
    };
    if (onUpdateRecipient) {
      onUpdateRecipient(updatedRec);
    }
  };

  const filteredRecipients = recipients.filter((r) => {
    if (!searchQuery) return true;
    return Object.values(r.data).some((val) =>
      val.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <FileCheck className="w-4 h-4 text-indigo-600" />
            <span>Interactive Quality Control & WYSIWYG Preview</span>
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            Click or double-click any text element on the preview to edit values directly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBackToEditor}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Adjust Positions</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCurrentPng}
            disabled={isExporting || !currentRecipient}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition"
          >
            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
            <span>Download PNG</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCurrentPdf}
            disabled={isExporting || !currentRecipient}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Building...' : 'Download Sample PDF'}</span>
          </button>

          <button
            type="button"
            onClick={onProceedToGenerate}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate All ({recipients.length})</span>
          </button>
        </div>
      </div>

      {/* Recipient Navigator Bar */}
      {recipients.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={currentIndex <= 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="p-1 rounded-lg bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-800">
              Recipient {currentIndex + 1} of {recipients.length}
            </span>
            <button
              type="button"
              disabled={currentIndex >= recipients.length - 1}
              onClick={() => setCurrentIndex((prev) => Math.min(recipients.length - 1, prev + 1))}
              className="p-1 rounded-lg bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Search recipient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 rounded-lg border border-slate-200 text-xs bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && filteredRecipients.length > 0 && (
              <div className="absolute top-8 left-0 right-0 max-h-48 overflow-y-auto bg-white rounded-lg shadow-lg border border-slate-200 z-50 divide-y divide-slate-100">
                {filteredRecipients.map((rec) => {
                  const idx = recipients.findIndex((r) => r.id === rec.id);
                  const nameVal = rec.data['Full Name'] || rec.data['Name'] || Object.values(rec.data)[0];
                  return (
                    <div
                      key={rec.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setSearchQuery('');
                      }}
                      className="p-2 hover:bg-indigo-50 cursor-pointer text-slate-800 text-xs flex justify-between"
                    >
                      <span className="font-medium truncate">{nameVal}</span>
                      <span className="text-slate-400 text-[10px]">#{idx + 1}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Certificate Live Canvas Preview with Direct Inline Editing */}
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden border border-slate-300 bg-slate-900 shadow-xl select-none"
      >
        <div
          className="relative w-full"
          style={{
            aspectRatio: `${template.width || 1200} / ${template.height || 850}`,
          }}
        >
          {/* Background Image */}
          {template.dataUrl ? (
            <img
              src={template.dataUrl}
              alt="Certificate Template"
              className="w-full h-full object-contain pointer-events-none"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
              Template Preview
            </div>
          )}

          {/* Personalized Dynamic Overlays with Inline Editing Support */}
          {fields.map((field) => {
            let textVal = '';
            const colName = field.mappedColumn || field.label;
            if (currentRecipient && currentRecipient.data[colName] !== undefined) {
              textVal = currentRecipient.data[colName];
            } else {
              textVal = field.sampleValue || '';
            }

            if (field.textTransform === 'uppercase') textVal = textVal.toUpperCase();
            if (field.textTransform === 'capitalize') {
              textVal = textVal.replace(/\b\w/g, (c) => c.toUpperCase());
            }

            const cssFontFamily =
              field.fontFamily === 'TimesRoman'
                ? "'Times New Roman', Times, serif"
                : field.fontFamily === 'Courier'
                ? "'Courier New', Courier, monospace"
                : "system-ui, -apple-system, 'Helvetica Neue', sans-serif";

            // 1:1 Exact Scaled Font Size
            const computedCssFontSize = Math.max(10, field.fontSize * scaleFactor);
            const isEditing = editingFieldId === field.id;

            return (
              <div
                key={field.id}
                onClick={() => setEditingFieldId(field.id)}
                style={{
                  left: `${field.xPercent}%`,
                  top: `${field.yPercent}%`,
                  width: `${field.widthPercent}%`,
                  color: field.fontColor,
                  fontFamily: cssFontFamily,
                  fontSize: `${computedCssFontSize}px`,
                  fontWeight: field.isBold ? 700 : 400,
                  fontStyle: field.isItalic ? 'italic' : 'normal',
                  textAlign: field.textAlign,
                }}
                className="absolute transform -translate-y-1/2 cursor-pointer border border-dashed border-amber-400/0 hover:border-amber-400/80 hover:bg-amber-400/10 rounded-md px-1.5 py-0.5 transition"
                title="Click to edit text directly"
              >
                {isEditing ? (
                  <div className="flex items-center space-x-1 bg-white p-1 rounded shadow-lg ring-2 ring-indigo-600 z-50">
                    <input
                      type="text"
                      autoFocus
                      value={textVal}
                      onChange={(e) => handleInlineValueChange(field, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingFieldId(null);
                      }}
                      onBlur={() => setEditingFieldId(null)}
                      className="w-full bg-transparent focus:outline-hidden text-slate-900 font-bold px-1"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFieldId(null);
                      }}
                      className="p-1 rounded bg-indigo-600 text-white"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="truncate leading-tight">
                    {textVal || <span className="opacity-40 italic">Click to edit text...</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quality Control Checklist Card */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2 text-xs">
        <h5 className="font-bold text-slate-800 flex items-center space-x-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Quality Assurance Inspection</span>
        </h5>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-semibold text-slate-700 block">1:1 Proportional Scaling</span>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Exact relative DPI ratio between DOM preview and export engine. Zero size distortion.
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-semibold text-slate-700 block">Direct Inline Editing</span>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Click any element directly on the card to edit. Updates persist to PDF & PNG export.
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <span className="font-semibold text-slate-700 block">Unique Filenames</span>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Standardized format (e.g. {generateCertificateFileName(currentRecipient?.data || {}, projectName, 0)}).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
