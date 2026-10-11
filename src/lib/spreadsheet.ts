import * as XLSX from 'xlsx';
import { RecipientRecord, ValidationSummary, FieldConfig } from '../types/certificate';

// Parse file (CSV or XLSX) into headers and rows of string key-values
export async function parseSpreadsheetFile(file: File): Promise<{
  headers: string[];
  records: Record<string, string>[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('File is empty or could not be read.'));
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary', raw: false });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error('No sheets found in spreadsheet.'));
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          raw: false,
        });

        if (rawJson.length === 0) {
          reject(new Error('Spreadsheet has no data rows.'));
          return;
        }

        // Collect all distinct headers across rows
        const headersSet = new Set<string>();
        rawJson.forEach((row) => {
          Object.keys(row).forEach((k) => {
            const trimmed = k.trim();
            if (trimmed) headersSet.add(trimmed);
          });
        });

        const headers = Array.from(headersSet);

        // Normalize each row to string values
        const records: Record<string, string>[] = rawJson.map((row) => {
          const cleanRow: Record<string, string> = {};
          headers.forEach((h) => {
            cleanRow[h] = String(row[h] !== undefined ? row[h] : '').trim();
          });
          return cleanRow;
        });

        resolve({ headers, records });
      } catch (err: any) {
        reject(new Error(err?.message || 'Failed to parse spreadsheet file. Please check file format.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read the file.'));
    };

    reader.readAsBinaryString(file);
  });
}

// Auto-detect best column match for a field
export function suggestColumnMatch(fieldName: string, availableColumns: string[]): string {
  const normField = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const col of availableColumns) {
    const normCol = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normField === normCol) return col;
  }

  // Keywords heuristics
  const patterns: { keywords: string[]; matchAgainst: string[] }[] = [
    { keywords: ['name', 'recipient', 'participant', 'student', 'attendee'], matchAgainst: ['name', 'fullname', 'recipientname'] },
    { keywords: ['id', 'certid', 'cert', 'serial', 'code', 'number'], matchAgainst: ['certid', 'certificateid', 'id'] },
    { keywords: ['course', 'event', 'workshop', 'program', 'topic', 'track'], matchAgainst: ['coursename', 'course', 'event'] },
    { keywords: ['org', 'company', 'institute', 'organization', 'academy'], matchAgainst: ['organization', 'orgname', 'organizationname'] },
    { keywords: ['issuedate', 'issue', 'date'], matchAgainst: ['date', 'issuedate'] },
    { keywords: ['completiondate', 'completed', 'enddate'], matchAgainst: ['completiondate'] },
    { keywords: ['designation', 'role', 'title', 'position'], matchAgainst: ['designation', 'role'] },
  ];

  for (const col of availableColumns) {
    const lower = col.toLowerCase();
    for (const pat of patterns) {
      if (pat.matchAgainst.includes(normField)) {
        if (pat.keywords.some((kw) => lower.includes(kw))) {
          return col;
        }
      }
    }
  }

  return availableColumns[0] || '';
}

// Validate recipient records against field mappings
export function validateRecipients(
  records: Record<string, string>[],
  fields: FieldConfig[]
): {
  validatedRecords: RecipientRecord[];
  summary: ValidationSummary;
} {
  const idMap = new Map<string, number>();
  const validatedRecords: RecipientRecord[] = [];
  const errorsList: { rowNumber: number; errors: string[] }[] = [];

  let missingNames = 0;
  let duplicateIds = 0;

  // Identify field mapped to full name and cert id
  const nameField = fields.find((f) => f.type === 'full_name');
  const idField = fields.find((f) => f.type === 'cert_id');

  // Check which fields have unmapped or empty columns
  const unmappedFields: string[] = fields
    .filter((f) => !f.mappedColumn)
    .map((f) => f.label);

  records.forEach((row, index) => {
    const errors: string[] = [];

    // 1. Check Full Name
    if (nameField && nameField.mappedColumn) {
      const val = row[nameField.mappedColumn];
      if (!val || !val.trim()) {
        errors.push(`Missing recipient name in column "${nameField.mappedColumn}"`);
        missingNames++;
      }
    }

    // 2. Check Certificate ID duplicate
    if (idField && idField.mappedColumn) {
      const val = (row[idField.mappedColumn] || '').trim();
      if (val) {
        if (idMap.has(val)) {
          errors.push(`Duplicate Certificate ID: "${val}" (already used on row ${idMap.get(val)})`);
          duplicateIds++;
        } else {
          idMap.set(val, index + 1);
        }
      }
    }

    const isValid = errors.length === 0;
    if (!isValid) {
      errorsList.push({ rowNumber: index + 1, errors });
    }

    validatedRecords.push({
      id: `rec_${index + 1}_${Date.now()}`,
      data: row,
      isValid,
      validationErrors: errors,
      status: 'pending',
    });
  });

  const validCount = validatedRecords.filter((r) => r.isValid).length;
  const invalidCount = validatedRecords.length - validCount;

  return {
    validatedRecords,
    summary: {
      total: validatedRecords.length,
      valid: validCount,
      invalid: invalidCount,
      missingNames,
      duplicateIds,
      unmappedFields,
      errorsList,
    },
  };
}

// Download Sample CSV template
export function downloadSampleCsv() {
  const headers = ['Full Name', 'Certificate ID', 'Course Name', 'Organization Name', 'Issue Date', 'Designation'];
  const sampleRows = [
    ['Rahul Patil', 'CERT-001', 'Full Stack Web Development & Cloud Systems', 'Apex Institute', '10 Oct 2026', 'Software Engineer'],
    ['Priya Sharma', 'CERT-002', 'Full Stack Web Development & Cloud Systems', 'Apex Institute', '10 Oct 2026', 'Data Analyst'],
    ['Amit Deshmukh', 'CERT-003', 'Full Stack Web Development & Cloud Systems', 'Apex Institute', '10 Oct 2026', 'Solutions Architect'],
  ];

  const csvContent = [
    headers.join(','),
    ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'CertiFlow_Sample_Recipients_Template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Export recipient generation status report as CSV
export function exportGenerationReportCsv(recipients: RecipientRecord[], projectName: string) {
  if (recipients.length === 0) return;

  const dataKeys = Object.keys(recipients[0]?.data || {});
  const headers = [...dataKeys, 'Generation Status', 'Generated Filename', 'Error Details'];

  const rows = recipients.map((r) => {
    const dataVals = dataKeys.map((k) => `"${(r.data[k] || '').replace(/"/g, '""')}"`);
    const statusVal = `"${r.status}"`;
    const fileVal = `"${(r.generatedFileName || '').replace(/"/g, '""')}"`;
    const errVal = `"${(r.errorMessage || r.validationErrors.join('; ')).replace(/"/g, '""')}"`;
    return [...dataVals, statusVal, fileVal, errVal].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Generation_Report.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
