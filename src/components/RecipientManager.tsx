import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Trash2,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Link2,
  UserPlus,
  X,
  Check,
  Search,
  SlidersHorizontal,
  Mail,
  User,
} from 'lucide-react';
import { FieldConfig, RecipientRecord } from '../types/certificate';
import {
  parseSpreadsheetFile,
  suggestColumnMatch,
  validateRecipients,
  downloadSampleCsv,
  ParsedSpreadsheetResult,
  isValidEmail,
} from '../lib/spreadsheet';
import { SAMPLE_RECIPIENTS_DATA } from '../lib/sampleTemplates';
import { ColumnMappingModal } from './ColumnMappingModal';

interface RecipientManagerProps {
  fields: FieldConfig[];
  recipients: RecipientRecord[];
  availableColumns: string[];
  onChangeRecipients: (recipients: RecipientRecord[]) => void;
  onChangeColumns: (columns: string[]) => void;
  onUpdateFields: (fields: FieldConfig[]) => void;
}

export const RecipientManager: React.FC<RecipientManagerProps> = ({
  fields,
  recipients,
  availableColumns,
  onChangeRecipients,
  onChangeColumns,
  onUpdateFields,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'errors' | 'valid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column Mapping Modal State
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [pendingParseResult, setPendingParseResult] = useState<ParsedSpreadsheetResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Manual Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecipientIndex, setEditingRecipientIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [modalSuccessMsg, setModalSuccessMsg] = useState<string | null>(null);

  // Default columns list if none present
  const defaultColumnsList = [
    'Full Name',
    'Email',
    'Certificate ID',
    'Course Name',
    'Organization Name',
    'Issue Date',
    'Completion Date',
    'Designation',
  ];

  const activeColumns = availableColumns.length > 0 ? availableColumns : defaultColumnsList;

  // Compute live validation summary
  const rawRecords = recipients.map((r) => r.data);
  const { summary } = validateRecipients(rawRecords, fields, activeColumns);

  // 1. File Upload Handler: Parses fast via ArrayBuffer and opens Column Mapping Modal
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setSuccessMessage(null);

    try {
      const parsed = await parseSpreadsheetFile(file);
      setPendingParseResult(parsed);
      setUploadedFileName(file.name);
      setIsMappingModalOpen(true);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setUploadError(err?.message || 'Failed to read spreadsheet file. Please check format.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 2. Confirms Column Mapping from Interactive Dialog
  const handleConfirmMapping = (
    updatedFields: FieldConfig[],
    selectedImportColumns: string[]
  ) => {
    if (!pendingParseResult) return;

    onUpdateFields(updatedFields);
    onChangeColumns(selectedImportColumns);

    // Validate records against updated fields & selected columns
    const { validatedRecords, summary: newSummary } = validateRecipients(
      pendingParseResult.records,
      updatedFields,
      selectedImportColumns
    );

    onChangeRecipients(validatedRecords);
    setIsMappingModalOpen(false);

    setSuccessMessage(
      `Successfully imported ${validatedRecords.length} recipients (${newSummary.valid} ready to generate) from "${uploadedFileName}".`
    );
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // 3. Open Re-mapping Dialog for existing columns
  const handleOpenRemapDialog = () => {
    if (activeColumns.length === 0) return;

    // Build synthetic preview rows from existing recipients
    const previewRows = recipients.slice(0, 5).map((r) => r.data);

    setPendingParseResult({
      sheetName: 'Active Roster',
      allSheetNames: ['Active Roster'],
      headers: activeColumns,
      records: recipients.map((r) => r.data),
      totalRows: recipients.length,
      previewRows: previewRows.length > 0 ? previewRows : [{}],
    });
    setUploadedFileName('Current Roster');
    setIsMappingModalOpen(true);
  };

  const handleLoadSampleData = () => {
    const headers = Object.keys(SAMPLE_RECIPIENTS_DATA[0]);
    onChangeColumns(headers);

    const updatedFields = fields.map((field) => {
      const suggested = suggestColumnMatch(field.label, headers);
      return { ...field, mappedColumn: suggested };
    });
    onUpdateFields(updatedFields);

    const { validatedRecords } = validateRecipients(SAMPLE_RECIPIENTS_DATA, updatedFields, headers);
    onChangeRecipients(validatedRecords);
    setSuccessMessage('Loaded 5 sample recipients with automatic column mapping.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleClearRoster = () => {
    if (recipients.length === 0) return;
    if (window.confirm('Are you sure you want to clear all recipients from the roster?')) {
      onChangeRecipients([]);
      setSuccessMessage('Roster cleared.');
      setTimeout(() => setSuccessMessage(null), 2000);
    }
  };

  // Helper column resolvers for active roster
  const getNameColumn = () =>
    activeColumns.find((c) => /^(full\s*name|name|student\s*name|candidate|participant|recipient)$/i.test(c)) ||
    activeColumns.find((c) => /name/i.test(c)) ||
    'Full Name';

  const getEmailColumn = () =>
    activeColumns.find((c) => /^(email|e-mail|email\s*address|mail)$/i.test(c)) ||
    activeColumns.find((c) => /email|mail/i.test(c)) ||
    'Email';

  const getIdColumn = () =>
    activeColumns.find((c) => /^(certificate\s*id|cert\s*id|cert_id|id|roll\s*no|registration)$/i.test(c)) ||
    activeColumns.find((c) => /id/i.test(c)) ||
    'Certificate ID';

  // Open Manual Entry Modal
  const handleOpenAddModal = () => {
    if (availableColumns.length === 0) {
      onChangeColumns(defaultColumnsList);
    }
    const nameCol = getNameColumn();
    const emailCol = getEmailColumn();

    const initialForm: Record<string, string> = {
      [nameCol]: '',
      [emailCol]: '',
    };

    activeColumns.forEach((col) => {
      if (col.toLowerCase().includes('date')) {
        initialForm[col] = '10 Oct 2026';
      } else if (initialForm[col] === undefined) {
        initialForm[col] = '';
      }
    });

    setFormData(initialForm);
    setFormErrors([]);
    setEditingRecipientIndex(null);
    setModalSuccessMsg(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal for a specific row
  const handleOpenEditModal = (index: number) => {
    const target = recipients[index];
    if (!target) return;
    const emailCol = getEmailColumn();
    const currentData: Record<string, string> = { ...target.data };

    // Synchronize email from recipient object if not explicitly in data
    if (!currentData[emailCol] && target.email) {
      currentData[emailCol] = target.email;
    }

    setFormData(currentData);
    setFormErrors([]);
    setEditingRecipientIndex(index);
    setModalSuccessMsg(null);
    setIsModalOpen(true);
  };

  const handleFormInputChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Save Recipient from Modal
  const handleSaveModalRecipient = (addAnother = false) => {
    const errors: string[] = [];
    const nameCol = getNameColumn();
    const emailCol = getEmailColumn();
    const idCol = getIdColumn();

    const nameVal = (formData[nameCol] || '').trim();
    const emailVal = (
      formData[emailCol] ||
      formData['Email'] ||
      formData['Email Address'] ||
      formData['email'] ||
      ''
    ).trim();

    if (!nameVal) {
      errors.push(`Full Name ("${nameCol}") is required.`);
    }

    if (!emailVal) {
      errors.push('Email Address is required for automated certificate delivery.');
    } else if (!isValidEmail(emailVal)) {
      errors.push(`Invalid email format ("${emailVal}"). Please enter a valid address like name@example.com.`);
    }

    if (idCol && formData[idCol] && formData[idCol].trim()) {
      const currentId = formData[idCol].trim();
      const existingDup = recipients.some(
        (r, idx) => idx !== editingRecipientIndex && (r.data[idCol] || '').trim() === currentId
      );
      if (existingDup) {
        errors.push(`Certificate ID "${currentId}" is already used by another recipient.`);
      }
    }

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    // Ensure email column exists in activeColumns so it populates the table headers
    let updatedColumns = [...activeColumns];
    if (!updatedColumns.some((c) => /email|mail/i.test(c))) {
      const nameIndex = updatedColumns.findIndex((c) => /name|candidate|student/i.test(c));
      if (nameIndex >= 0) {
        updatedColumns.splice(nameIndex + 1, 0, 'Email');
      } else {
        updatedColumns.unshift('Email');
      }
      onChangeColumns(updatedColumns);
    }

    const payloadData: Record<string, string> = {
      ...formData,
      [nameCol]: nameVal,
      [emailCol]: emailVal,
    };
    if (emailCol !== 'Email' && !payloadData['Email']) {
      payloadData['Email'] = emailVal;
    }

    let updatedRaw: Record<string, string>[] = [];
    if (editingRecipientIndex !== null) {
      updatedRaw = recipients.map((r, idx) =>
        idx === editingRecipientIndex ? payloadData : r.data
      );
    } else {
      updatedRaw = [...recipients.map((r) => r.data), payloadData];
    }

    const { validatedRecords } = validateRecipients(updatedRaw, fields, updatedColumns);
    onChangeRecipients(validatedRecords);

    if (addAnother) {
      const resetForm: Record<string, string> = {
        [nameCol]: '',
        [emailCol]: '',
      };
      updatedColumns.forEach((col) => {
        if (col.toLowerCase().includes('date')) resetForm[col] = '10 Oct 2026';
        else if (resetForm[col] === undefined) resetForm[col] = '';
      });
      setFormData(resetForm);
      setEditingRecipientIndex(null);
      setFormErrors([]);
      setModalSuccessMsg(`"${nameVal}" saved successfully! Ready for the next recipient.`);
      setTimeout(() => setModalSuccessMsg(null), 3000);
    } else {
      setIsModalOpen(false);
    }
  };

  // Direct Inline Cell Editing in the Roster Table
  const handleCellChange = (rowIndex: number, column: string, value: string) => {
    const updated = [...recipients];
    const target = updated[rowIndex];
    if (!target) return;

    target.data = {
      ...target.data,
      [column]: value,
    };

    const allRaw = updated.map((r) => r.data);
    const { validatedRecords } = validateRecipients(allRaw, fields, activeColumns);
    onChangeRecipients(validatedRecords);
  };

  const handleDeleteRow = (index: number) => {
    const updatedRaw = recipients.filter((_, idx) => idx !== index).map((r) => r.data);
    const { validatedRecords } = validateRecipients(updatedRaw, fields, activeColumns);
    onChangeRecipients(validatedRecords);
  };

  const handleColumnMappingChange = (fieldId: string, newCol: string) => {
    const updatedFields = fields.map((f) => (f.id === fieldId ? { ...f, mappedColumn: newCol } : f));
    onUpdateFields(updatedFields);

    const { validatedRecords } = validateRecipients(
      recipients.map((r) => r.data),
      updatedFields,
      activeColumns
    );
    onChangeRecipients(validatedRecords);
  };

  const displayedRecipients = recipients.filter((r) => {
    if (filterMode === 'errors' && r.isValid) return false;
    if (filterMode === 'valid' && !r.isValid) return false;
    if (searchQuery) {
      return Object.values(r.data).some((val) =>
        val.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <span>Recipient Roster & Data Import Pipeline</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload spreadsheets (.xlsx, .xls, .csv), map custom column headers, and review individual entries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />

            {/* Upload Spreadsheet Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition"
            >
              {isUploading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{isUploading ? 'Parsing File...' : 'Upload Excel / CSV'}</span>
            </button>

            {/* Interactive Column Mapping Dialog Button */}
            {recipients.length > 0 && (
              <button
                type="button"
                onClick={handleOpenRemapDialog}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Map Columns</span>
              </button>
            )}

            {/* Enter Manually */}
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Add Entry</span>
            </button>

            <button
              type="button"
              onClick={handleLoadSampleData}
              className="inline-flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-medium transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Load 5 Demo</span>
            </button>

            <button
              type="button"
              onClick={downloadSampleCsv}
              className="inline-flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sample CSV</span>
            </button>

            {recipients.length > 0 && (
              <button
                type="button"
                onClick={handleClearRoster}
                className="inline-flex items-center space-x-1 px-3 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-medium transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Upload Error Alert */}
      {uploadError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Quick Column Mapping Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link2 className="w-4 h-4 text-indigo-600" />
            <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Certificate Fields Column Mapping
            </h5>
          </div>
          <button
            type="button"
            onClick={handleOpenRemapDialog}
            className="text-[11px] text-indigo-600 font-semibold hover:underline flex items-center space-x-1"
          >
            <span>Open Advanced Mapping Modal</span>
            <SlidersHorizontal className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {fields.map((field) => {
            const isMapped = Boolean(field.mappedColumn && activeColumns.includes(field.mappedColumn));
            return (
              <div
                key={field.id}
                className={`p-2.5 rounded-xl border text-xs transition ${
                  isMapped ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-slate-800 truncate">{field.label}</span>
                  {isMapped ? (
                    <span className="text-[10px] text-emerald-700 font-medium">Mapped</span>
                  ) : (
                    <span className="text-[10px] text-amber-700 font-medium">Unmapped</span>
                  )}
                </div>
                <select
                  value={field.mappedColumn}
                  onChange={(e) => handleColumnMappingChange(field.id, e.target.value)}
                  className="w-full px-2 py-1 rounded-md border border-slate-300 text-xs bg-white font-medium focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Select Column --</option>
                  {activeColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Validation Summary Banner */}
      {recipients.length > 0 && (
        <div
          className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 text-xs ${
            summary.invalid === 0
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center space-x-3">
            {summary.invalid === 0 ? (
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className="font-bold text-sm">
                {summary.invalid === 0
                  ? `${summary.total} total rows detected • ${summary.valid} valid records ready to generate!`
                  : `Review Needed: ${summary.invalid} record(s) contain validation issues (${summary.valid} ready)`}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] opacity-90">
                <span>Total: {summary.total}</span>
                <span>•</span>
                <span className="text-emerald-700 font-semibold">Valid: {summary.valid}</span>
                {summary.missingNames > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-rose-600 font-semibold">
                      Missing Names: {summary.missingNames}
                    </span>
                  </>
                )}
                {summary.duplicateIds > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-rose-600 font-semibold">
                      Duplicate IDs: {summary.duplicateIds}
                    </span>
                  </>
                )}
                {summary.missingEmails > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-amber-700 font-semibold">
                      Missing Emails: {summary.missingEmails}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Search & Filter pills */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search roster..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 rounded-lg border border-slate-200 bg-white text-xs focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-1 bg-white/70 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  filterMode === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All ({recipients.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('valid')}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  filterMode === 'valid' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Valid ({summary.valid})
              </button>
              {summary.invalid > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode('errors')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    filterMode === 'errors' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Errors ({summary.invalid})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recipient Editable Table with Direct Inline Editing */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Unified Recipient Roster ({recipients.length})
            </span>
            <span className="text-xs text-slate-400">• Double-click or type directly in any cell to edit</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Recipient</span>
            </button>
          </div>
        </div>

        {recipients.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs space-y-3">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300" />
            <div>
              <p className="font-semibold text-slate-700 text-sm">No recipients loaded yet</p>
              <p className="mt-1 text-slate-500">
                Upload a spreadsheet (.xlsx / .csv) or click &quot;+ Add Entry&quot; above.
              </p>
            </div>
            <div className="flex justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Upload Excel / CSV
              </button>
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                Enter Manually
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-600 w-24">Status</th>
                  {activeColumns.map((col) => (
                    <th key={col} className="py-2.5 px-3 font-semibold text-slate-700 min-w-[150px]">
                      {col}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 font-semibold text-slate-600 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRecipients.map((recipient) => {
                  const actualIndex = recipients.findIndex((r) => r.id === recipient.id);
                  return (
                    <tr
                      key={recipient.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !recipient.isValid ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                        {actualIndex + 1}
                      </td>
                      <td className="py-2 px-3">
                        {recipient.isValid ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Valid</span>
                          </span>
                        ) : (
                          <span
                            title={recipient.validationErrors.join(', ')}
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800 cursor-help"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            <span>Fix Needed</span>
                          </span>
                        )}
                      </td>
                      {activeColumns.map((col) => (
                        <td key={col} className="py-1 px-2">
                          <input
                            type="text"
                            value={recipient.data[col] || ''}
                            onChange={(e) => handleCellChange(actualIndex, col, e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white text-xs bg-transparent transition font-medium text-slate-800"
                            placeholder="Click to type..."
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(actualIndex)}
                            className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="Edit details in modal form"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteRow(actualIndex)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete recipient"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interactive Column Mapping Dialog */}
      {pendingParseResult && (
        <ColumnMappingModal
          isOpen={isMappingModalOpen}
          fileName={uploadedFileName}
          sheetName={pendingParseResult.sheetName}
          detectedHeaders={pendingParseResult.headers}
          previewRows={pendingParseResult.previewRows}
          totalRows={pendingParseResult.totalRows}
          fields={fields}
          onConfirm={handleConfirmMapping}
          onClose={() => setIsMappingModalOpen(false)}
        />
      )}

      {/* Manual Add / Edit Recipient Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base text-slate-900">
                  {editingRecipientIndex !== null ? 'Edit Recipient Details' : 'Add Recipient Manually'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error alerts */}
            {formErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                {formErrors.map((err, i) => (
                  <p key={i} className="flex items-center space-x-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{err}</span>
                  </p>
                ))}
              </div>
            )}

            {/* Success alert on Save & Add Another */}
            {modalSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-1.5 font-semibold">
                <Check className="w-4 h-4" />
                <span>{modalSuccessMsg}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto pr-1 text-xs">
              {/* 1. Full Name (Required) */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <span>Full Name</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Primary Recipient</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={formData[getNameColumn()] || ''}
                    onChange={(e) => handleFormInputChange(getNameColumn(), e.target.value)}
                    placeholder="e.g. Alexander Hamilton"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-800 placeholder:text-slate-400 transition"
                  />
                </div>
              </div>

              {/* 2. Email Address (Required for Distribution) */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <span>Email Address</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </span>
                  <span className="text-[10px] text-indigo-600 font-semibold">For Auto Delivery</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="email"
                    value={
                      formData[getEmailColumn()] !== undefined
                        ? formData[getEmailColumn()]
                        : formData['Email'] || formData['Email Address'] || ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      handleFormInputChange(getEmailColumn(), val);
                      if (getEmailColumn() !== 'Email') {
                        handleFormInputChange('Email', val);
                      }
                    }}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-800 placeholder:text-slate-400 transition"
                  />
                </div>
              </div>

              {/* 3. Additional Columns from Roster / Template */}
              {activeColumns
                .filter(
                  (col) =>
                    col !== getNameColumn() &&
                    col !== getEmailColumn() &&
                    !/^(email|e-mail|email\s*address|mail)$/i.test(col) &&
                    !/^(full\s*name|name|student\s*name|candidate|participant|recipient)$/i.test(col)
                )
                .map((col) => {
                  const isId = /id|cert|registration|roll/i.test(col);
                  const isDate = /date/i.test(col);
                  const placeholder = isId
                    ? 'e.g. CERT-2026-001'
                    : isDate
                    ? 'e.g. 10 Oct 2026'
                    : /course/i.test(col)
                    ? 'e.g. Full Stack Web Development'
                    : /org/i.test(col)
                    ? 'e.g. Tech Excellence Academy'
                    : /desig|role/i.test(col)
                    ? 'e.g. Software Engineer'
                    : `Enter ${col.toLowerCase()}...`;

                  return (
                    <div key={col} className="space-y-1">
                      <label className="font-semibold text-slate-700 flex items-center justify-between">
                        <span>{col}</span>
                        {isId && (
                          <span className="text-[10px] text-slate-400 font-normal">Unique ID</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={formData[col] || ''}
                        onChange={(e) => handleFormInputChange(col, e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 placeholder:text-slate-400 transition"
                      />
                    </div>
                  );
                })}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  const nameCol = getNameColumn();
                  const emailCol = getEmailColumn();
                  const reset: Record<string, string> = {
                    [nameCol]: '',
                    [emailCol]: '',
                    Email: '',
                  };
                  activeColumns.forEach((c) => {
                    if (c.toLowerCase().includes('date')) reset[c] = '10 Oct 2026';
                    else reset[c] = '';
                  });
                  setFormData(reset);
                  setFormErrors([]);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition"
              >
                Clear Form
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition"
                >
                  Cancel
                </button>

                {editingRecipientIndex === null && (
                  <button
                    type="button"
                    onClick={() => handleSaveModalRecipient(true)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition shadow-xs"
                  >
                    Save & Add Another
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSaveModalRecipient(false)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-md shadow-indigo-500/20"
                >
                  {editingRecipientIndex !== null ? 'Save Changes' : 'Save Recipient'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
