import React, { useState, useEffect } from 'react';
import {
  Table,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  FileSpreadsheet,
  Check,
  Eye,
  Columns,
  Filter,
  Sparkles,
} from 'lucide-react';
import { FieldConfig } from '../types/certificate';
import { suggestColumnMatch } from '../lib/spreadsheet';

interface ColumnMappingModalProps {
  isOpen: boolean;
  fileName: string;
  sheetName: string;
  detectedHeaders: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
  fields: FieldConfig[];
  onConfirm: (
    updatedFields: FieldConfig[],
    selectedImportColumns: string[]
  ) => void;
  onClose: () => void;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  fileName,
  sheetName,
  detectedHeaders,
  previewRows,
  totalRows,
  fields,
  onConfirm,
  onClose,
}) => {
  // Mapping state: field.id -> detectedHeader (or empty string for skipped)
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});

  // Which columns to actually import into the roster (Skip unwanted columns feature)
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());

  // Initialize mappings with smart auto-detection
  useEffect(() => {
    if (!isOpen) return;

    const initialMappings: Record<string, string> = {};
    const autoSelectedCols = new Set<string>();

    fields.forEach((field) => {
      // If already mapped and exists in detectedHeaders, preserve it
      if (field.mappedColumn && detectedHeaders.includes(field.mappedColumn)) {
        initialMappings[field.id] = field.mappedColumn;
        autoSelectedCols.add(field.mappedColumn);
      } else {
        // Run auto-detect heuristics
        const suggested = suggestColumnMatch(field.label, detectedHeaders);
        initialMappings[field.id] = suggested;
        if (suggested) {
          autoSelectedCols.add(suggested);
        }
      }
    });

    // By default, select all detected headers so user doesn't lose columns unless they want to
    detectedHeaders.forEach((h) => autoSelectedCols.add(h));

    setFieldMappings(initialMappings);
    setSelectedColumns(autoSelectedCols);
  }, [isOpen, fields, detectedHeaders]);

  if (!isOpen) return null;

  const handleFieldMappingChange = (fieldId: string, headerName: string) => {
    setFieldMappings((prev) => ({ ...prev, [fieldId]: headerName }));
    if (headerName) {
      setSelectedColumns((prev) => new Set([...prev, headerName]));
    }
  };

  const toggleColumnSelection = (headerName: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(headerName)) {
        next.delete(headerName);
      } else {
        next.add(headerName);
      }
      return next;
    });
  };

  const handleSelectAllColumns = () => {
    setSelectedColumns(new Set(detectedHeaders));
  };

  const handleDeselectAllExceptMapped = () => {
    const mappedOnly = new Set<string>();
    Object.values(fieldMappings).forEach((col) => {
      if (col) mappedOnly.add(col);
    });
    setSelectedColumns(mappedOnly);
  };

  // Check whether Recipient Name is mapped
  const nameField = fields.find((f) => f.type === 'full_name');
  const isNameMapped = nameField ? Boolean(fieldMappings[nameField.id]) : true;

  // Calculate mapped columns count
  const mappedCount = Object.values(fieldMappings).filter(Boolean).length;

  const handleApply = () => {
    const updatedFields = fields.map((f) => ({
      ...f,
      mappedColumn: fieldMappings[f.id] || '',
    }));

    onConfirm(updatedFields, Array.from(selectedColumns));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-slate-900">
                  Spreadsheet Column Mapping & Preview
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                  {totalRows} Rows Detected
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                File: <strong className="text-slate-700">{fileName}</strong> • Sheet:{' '}
                <strong className="text-slate-700">{sheetName}</strong> • {detectedHeaders.length} Columns Found
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Section 1: Live Sample Preview of First 3 Rows */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>Live Data Preview (First {previewRows.length} Rows of Uploaded File)</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Verify that your column headers and cell values look correct
              </span>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto max-h-[160px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/80 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-semibold text-slate-500 text-[10px] w-10">#</th>
                      {detectedHeaders.map((header) => {
                        const isMapped = Object.values(fieldMappings).includes(header);
                        const isSelected = selectedColumns.has(header);

                        return (
                          <th
                            key={header}
                            className={`py-2 px-3 font-semibold text-slate-700 text-xs whitespace-nowrap ${
                              isMapped ? 'bg-indigo-50 text-indigo-900 border-b-2 border-indigo-500' : ''
                            } ${!isSelected ? 'opacity-40' : ''}`}
                          >
                            <div className="flex items-center space-x-1">
                              <span>{header}</span>
                              {isMapped && (
                                <span className="px-1 py-0.2 rounded bg-indigo-200 text-indigo-800 text-[9px] font-bold">
                                  Mapped
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {previewRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{rIdx + 1}</td>
                        {detectedHeaders.map((header) => (
                          <td
                            key={header}
                            className={`py-2 px-3 text-slate-600 whitespace-nowrap max-w-xs truncate font-medium ${
                              !selectedColumns.has(header) ? 'opacity-40 line-through' : ''
                            }`}
                          >
                            {row[header] || <span className="text-slate-300 italic">empty</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 2: Interactive Target Field Mapping Selectors */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Columns className="w-3.5 h-3.5 text-indigo-600" />
                <span>Map Certificate Dynamic Fields to Excel Columns</span>
              </span>
              <span className="text-[11px] font-semibold text-indigo-600">
                {mappedCount} of {fields.length} Fields Linked
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map((field) => {
                const currentMappedCol = fieldMappings[field.id] || '';
                const sampleValue =
                  currentMappedCol && previewRows[0] && previewRows[0][currentMappedCol] !== undefined
                    ? previewRows[0][currentMappedCol]
                    : field.sampleValue;

                const isRequired = field.type === 'full_name';

                return (
                  <div
                    key={field.id}
                    className={`p-3.5 rounded-2xl border transition ${
                      currentMappedCol
                        ? 'bg-indigo-50/40 border-indigo-200 ring-1 ring-indigo-500/10'
                        : isRequired
                        ? 'bg-rose-50/30 border-rose-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-800 text-xs">{field.label}</span>
                        {isRequired && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                            Required
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 capitalize">{field.type}</span>
                    </div>

                    <div className="space-y-1.5">
                      <select
                        value={currentMappedCol}
                        onChange={(e) => handleFieldMappingChange(field.id, e.target.value)}
                        className={`w-full px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                          currentMappedCol
                            ? 'border-indigo-300 bg-white text-indigo-900 focus:ring-2 focus:ring-indigo-500'
                            : isRequired
                            ? 'border-rose-300 bg-white text-rose-900 focus:ring-2 focus:ring-rose-500'
                            : 'border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <option value="">-- Skip / Use Template Default --</option>
                        {detectedHeaders.map((header) => (
                          <option key={header} value={header}>
                            Column: {header}
                          </option>
                        ))}
                      </select>

                      {/* Row 1 Sample Value Preview */}
                      <div className="text-[10px] text-slate-500 flex items-center justify-between px-1">
                        <span>Row 1 Preview:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[180px]">
                          {sampleValue ? `"${sampleValue}"` : <span className="italic text-slate-400">Empty</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Skip / Ignore Unwanted Columns Feature */}
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Choose Columns to Import (Skip Unwanted Columns)</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Uncheck columns you do not wish to store in the roster (e.g. phone numbers, addresses, internal codes).
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAllColumns}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[10px] font-semibold text-slate-700 transition"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllExceptMapped}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[10px] font-semibold text-indigo-700 transition"
                >
                  Only Mapped Columns
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {detectedHeaders.map((header) => {
                const isSelected = selectedColumns.has(header);
                const isMapped = Object.values(fieldMappings).includes(header);

                return (
                  <button
                    key={header}
                    type="button"
                    onClick={() => toggleColumnSelection(header)}
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                      isSelected
                        ? isMapped
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-slate-800 border-slate-300 hover:border-slate-400'
                        : 'bg-slate-100 text-slate-400 border-slate-200 line-through opacity-60'
                    }`}
                  >
                    <span className="w-3 h-3 rounded flex items-center justify-center border border-current text-[9px]">
                      {isSelected ? '✓' : ''}
                    </span>
                    <span>{header}</span>
                    {isMapped && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/40 font-bold">
                        Linked
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Validation Feedback Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center space-x-3 ${
              isNameMapped
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {isNameMapped ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-bold">
                {isNameMapped
                  ? `All Set! ${totalRows} records detected • Ready for Bulk Certificate Generation.`
                  : 'Notice: Recipient Full Name is not mapped to any column.'}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5">
                {isNameMapped
                  ? `${selectedColumns.size} of ${detectedHeaders.length} columns will be imported. Unselected columns will be safely skipped.`
                  : 'Please select which Excel column contains the recipient names to ensure personalized certificates are generated properly.'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {selectedColumns.size} columns selected • {totalRows} records ready to import
          </span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-xs"
            >
              <span>Apply Mapping & Import Roster ({totalRows} Rows)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
