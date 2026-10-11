import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Download,
  FolderArchive,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  FileText,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  CertificateTemplate,
  FieldConfig,
  RecipientRecord,
} from '../types/certificate';
import {
  generateSingleCertificatePdf,
  generateCertificateFileName,
  createCertificatesZip,
  downloadBlob,
} from '../lib/pdfEngine';
import { exportGenerationReportCsv } from '../lib/spreadsheet';
import { saveGeneratedPdfBlob } from '../lib/storageHelper';

interface BulkGeneratorProps {
  template: CertificateTemplate;
  fields: FieldConfig[];
  recipients: RecipientRecord[];
  projectName: string;
  projectId: string;
  onGenerationComplete: (generatedCount: number, failedCount: number) => void;
}

interface GeneratedItem {
  id: string;
  recipient: RecipientRecord;
  fileName: string;
  blob: Blob;
}

export const BulkGenerator: React.FC<BulkGeneratorProps> = ({
  template,
  fields,
  recipients,
  projectName,
  projectId,
  onGenerationComplete,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentRecipientLabel, setCurrentRecipientLabel] = useState('');
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
  const [failedItems, setFailedItems] = useState<{ recipient: RecipientRecord; error: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const validRecipients = recipients.filter((r) => r.isValid);

  const startBulkGeneration = async (targetBatch = validRecipients) => {
    if (targetBatch.length === 0) return;

    setIsGenerating(true);
    setProgressPercent(0);
    const successfullyGenerated: GeneratedItem[] = [];
    const failedList: { recipient: RecipientRecord; error: string }[] = [];

    const total = targetBatch.length;

    for (let i = 0; i < total; i++) {
      const recipient = targetBatch[i];
      const nameKey = recipient.data['Full Name'] || recipient.data['Name'] || Object.values(recipient.data)[0] || `Recipient ${i + 1}`;
      setCurrentRecipientLabel(nameKey);

      try {
        const blob = await generateSingleCertificatePdf(template, fields, recipient.data);
        const fileName = generateCertificateFileName(recipient.data, projectName, i);

        const item: GeneratedItem = {
          id: recipient.id,
          recipient: {
            ...recipient,
            status: 'success',
            generatedFileName: fileName,
          },
          fileName,
          blob,
        };

        // Persist blob locally so user can re-download anytime
        saveGeneratedPdfBlob(`${projectId}_${recipient.id}`, blob).catch(console.warn);

        successfullyGenerated.push(item);
      } catch (err: any) {
        failedList.push({
          recipient: {
            ...recipient,
            status: 'failed',
            errorMessage: err?.message || 'PDF render failed',
          },
          error: err?.message || 'Generation failed',
        });
      }

      setProgressPercent(Math.round(((i + 1) / total) * 100));
    }

    setGeneratedItems(successfullyGenerated);
    setFailedItems(failedList);
    setIsGenerating(false);

    // Call completion callback to update project status in Firestore
    onGenerationComplete(successfullyGenerated.length, failedList.length);

    // Trigger celebration if generated successfully!
    if (successfullyGenerated.length > 0) {
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // no-op
      }
    }
  };

  // Download all generated certificates as a single ZIP
  const handleDownloadAllZip = async () => {
    if (generatedItems.length === 0) return;
    setIsZipping(true);
    try {
      const zipBlob = await createCertificatesZip(
        generatedItems.map((g) => ({ fileName: g.fileName, blob: g.blob }))
      );
      const zipFileName = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Certificates.zip`;
      downloadBlob(zipBlob, zipFileName);
    } catch (err) {
      console.error('Failed to create ZIP package:', err);
    } finally {
      setIsZipping(false);
    }
  };

  // Download selected certificates as ZIP
  const handleDownloadSelectedZip = async () => {
    const selectedItems = generatedItems.filter((g) => selectedIds.has(g.id));
    if (selectedItems.length === 0) return;
    setIsZipping(true);
    try {
      const zipBlob = await createCertificatesZip(
        selectedItems.map((g) => ({ fileName: g.fileName, blob: g.blob }))
      );
      const zipFileName = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Selected_${selectedItems.length}.zip`;
      downloadBlob(zipBlob, zipFileName);
    } catch (err) {
      console.error('Failed to create ZIP package:', err);
    } finally {
      setIsZipping(false);
    }
  };

  // Toggle select item
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === generatedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(generatedItems.map((g) => g.id)));
    }
  };

  // Export CSV generation report
  const handleExportReport = () => {
    const reportRecipients: RecipientRecord[] = [
      ...generatedItems.map((g) => g.recipient),
      ...failedItems.map((f) => f.recipient),
    ];
    exportGenerationReportCsv(reportRecipients, projectName);
  };

  return (
    <div className="space-y-6">
      {/* Generation Control Header */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>Bulk Certificate Generation Engine</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Generate crisp vector PDF certificates for {validRecipients.length} valid recipient(s).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => startBulkGeneration()}
              disabled={isGenerating || validRecipients.length === 0}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Batch...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {generatedItems.length > 0 ? 'Regenerate All Certificates' : 'Generate All Certificates'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress Display */}
        {isGenerating && (
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 space-y-2">
            <div className="flex justify-between items-center text-xs font-medium text-indigo-900">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Generating certificate for: <strong className="text-indigo-950">{currentRecipientLabel}</strong></span>
              </div>
              <span className="font-bold">{progressPercent}%</span>
            </div>
            <div className="w-full bg-indigo-200/80 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-150"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Post-generation Summary Banner */}
        {generatedItems.length > 0 && !isGenerating && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-900">
                  {generatedItems.length} Certificate(s) Ready for Export!
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  High-quality vector PDFs created with custom typography and design preservation.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadAllZip}
                disabled={isZipping}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
              >
                {isZipping ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FolderArchive className="w-3.5 h-3.5" />
                )}
                <span>{isZipping ? 'Archiving ZIP...' : 'Download All as ZIP'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportReport}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report (CSV)</span>
              </button>
            </div>
          </div>
        )}

        {/* Failed items retry alert */}
        {failedItems.length > 0 && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-900">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{failedItems.length} record(s) failed during generation.</span>
            </div>
            <button
              type="button"
              onClick={() => startBulkGeneration(failedItems.map((f) => f.recipient))}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition"
            >
              Retry Failed Records
            </button>
          </div>
        )}
      </div>

      {/* Generated Certificates List Table */}
      {generatedItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedIds.size === generatedItems.length && generatedItems.length > 0}
                onChange={toggleSelectAll}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-bold text-slate-800 uppercase tracking-wider">
                Generated Certificates ({generatedItems.length})
              </span>
              {selectedIds.size > 0 && (
                <span className="text-indigo-600 font-medium">({selectedIds.size} selected)</span>
              )}
            </div>

            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleDownloadSelectedZip}
                disabled={isZipping}
                className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold hover:bg-indigo-100 transition"
              >
                <FolderArchive className="w-3.5 h-3.5" />
                <span>Download Selected as ZIP ({selectedIds.size})</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto max-h-[440px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2.5 px-3 w-10"></th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600">Filename</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600">Recipient Name</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600">Certificate ID</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600">Course / Event</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 text-right pr-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {generatedItems.map((item, idx) => {
                  const isChecked = selectedIds.has(item.id);
                  const nameVal = item.recipient.data['Full Name'] || item.recipient.data['Name'] || '-';
                  const idVal = item.recipient.data['Certificate ID'] || item.recipient.data['ID'] || '-';
                  const courseVal = item.recipient.data['Course Name'] || item.recipient.data['Course'] || '-';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-medium">
                        <div className="flex items-center space-x-1.5">
                          <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="truncate max-w-[220px]">{item.fileName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{nameVal}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{idVal}</td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[200px]">{courseVal}</td>
                      <td className="py-2.5 px-3 text-right pr-4">
                        <button
                          type="button"
                          onClick={() => downloadBlob(item.blob, item.fileName)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 font-semibold transition"
                          title="Download individual PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
