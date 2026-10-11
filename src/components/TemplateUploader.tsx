import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, Sparkles, Check, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { CertificateTemplate } from '../types/certificate';
import { processTemplateFile } from '../lib/templateLoader';
import { SAMPLE_TEMPLATES, createSampleTemplateDataUrl } from '../lib/sampleTemplates';

interface TemplateUploaderProps {
  currentTemplate: CertificateTemplate | null;
  onTemplateSelected: (template: CertificateTemplate) => void;
}

export const TemplateUploader: React.FC<TemplateUploaderProps> = ({
  currentTemplate,
  onTemplateSelected,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setIsLoading(true);
    try {
      const template = await processTemplateFile(file);
      onTemplateSelected(template);
    } catch (err: any) {
      setError(err?.message || 'Failed to process template file. Please try another image or PDF.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSelectSample = (sample: typeof SAMPLE_TEMPLATES[0]) => {
    setError(null);
    const dataUrl = createSampleTemplateDataUrl(sample.theme);
    const template: CertificateTemplate = {
      name: `${sample.name}.svg`,
      type: 'image',
      mimeType: 'image/svg+xml',
      dataUrl,
      pageNumber: 1,
      pageCount: 1,
      width: sample.width,
      height: sample.height,
      orientation: sample.orientation,
    };
    onTemplateSelected(template);
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
            {isLoading ? (
              <RefreshCw className="w-7 h-7 animate-spin" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>
          <div>
            <h4 className="text-base font-semibold text-slate-800">
              {isLoading ? 'Processing template...' : 'Upload Certificate Template'}
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Drag & drop your certificate design, or click to browse
            </p>
          </div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-slate-100 rounded-full text-[11px] font-medium text-slate-600">
            <span>Supports PDF (Vector), PNG, JPG up to 25MB</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Upload Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Current Template Preview */}
      {currentTemplate && (
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                {currentTemplate.type === 'pdf' ? (
                  <FileText className="w-5 h-5" />
                ) : (
                  <ImageIcon className="w-5 h-5" />
                )}
              </div>
              <div>
                <h5 className="text-sm font-semibold text-slate-900">{currentTemplate.name}</h5>
                <p className="text-xs text-slate-500">
                  {currentTemplate.type.toUpperCase()} • {currentTemplate.width} × {currentTemplate.height} pt •{' '}
                  <span className="capitalize">{currentTemplate.orientation}</span>
                  {currentTemplate.pageCount > 1 && ` • Page ${currentTemplate.pageNumber} of ${currentTemplate.pageCount}`}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
              <Check className="w-3.5 h-3.5" />
              <span>Loaded & Ready</span>
            </span>
          </div>

          {/* PDF Multi-page selector if PDF has multiple pages */}
          {currentTemplate.type === 'pdf' && currentTemplate.pageCount > 1 && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Select PDF Page for Template:</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={currentTemplate.pageNumber <= 1}
                  onClick={() =>
                    onTemplateSelected({
                      ...currentTemplate,
                      pageNumber: Math.max(1, currentTemplate.pageNumber - 1),
                    })
                  }
                  className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-slate-800">
                  Page {currentTemplate.pageNumber} of {currentTemplate.pageCount}
                </span>
                <button
                  type="button"
                  disabled={currentTemplate.pageNumber >= currentTemplate.pageCount}
                  onClick={() =>
                    onTemplateSelected({
                      ...currentTemplate,
                      pageNumber: Math.min(currentTemplate.pageCount, currentTemplate.pageNumber + 1),
                    })
                  }
                  className="p-1 rounded bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-100"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Template Visual Thumbnail */}
          <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center max-h-[380px]">
            {currentTemplate.dataUrl.startsWith('data:image/') || currentTemplate.dataUrl.startsWith('data:image/svg+xml') ? (
              <img
                src={currentTemplate.dataUrl}
                alt="Template Preview"
                className="max-h-[360px] w-auto object-contain rounded shadow-xs"
              />
            ) : (
              <div className="p-12 text-center text-slate-500">
                <FileText className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-medium">PDF Vector Template Attached</p>
                <p className="text-xs text-slate-400 mt-1">Dimensions: {currentTemplate.width}pt × {currentTemplate.height}pt</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Or choose from Curated Sample Templates */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Or Pick a Ready-Made Template</span>
          </div>
          <span className="text-xs text-slate-500">High-res vector templates</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAMPLE_TEMPLATES.map((sample) => {
            const isSelected = currentTemplate?.name.includes(sample.name);
            const previewUrl = createSampleTemplateDataUrl(sample.theme);
            return (
              <div
                key={sample.id}
                onClick={() => handleSelectSample(sample)}
                className={`group cursor-pointer rounded-xl border p-3 transition-all duration-200 bg-white hover:shadow-md ${
                  isSelected
                    ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="relative aspect-[16/11] rounded-lg overflow-hidden bg-slate-100 border border-slate-200/80 mb-2.5">
                  <img
                    src={previewUrl}
                    alt={sample.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-indigo-600 text-white p-1 rounded-full shadow-md">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <h6 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">
                    {sample.name}
                  </h6>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{sample.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
