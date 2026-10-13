import * as XLSX from 'xlsx';
import { RecipientRecord, ValidationSummary, FieldConfig } from '../types/certificate';

export interface ParsedSpreadsheetResult {
  sheetName: string;
  allSheetNames: string[];
  headers: string[];
  records: Record<string, string>[];
  totalRows: number;
  previewRows: Record<string, string>[];
}

// Clean string helper: strips BOM, non-breaking spaces, and hidden whitespace
function cleanCellValue(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/\uFEFF/g, '') // Strip BOM
    .replace(/\u00A0/g, ' ') // Replace non-breaking space
    .replace(/[\r\n]+/g, ' ') // Normalize newlines
    .trim();
}

/**
 * Fast, memory-safe, robust spreadsheet parser (.xlsx, .xls, .csv).
 * Reads ArrayBuffer directly, handles messy headers, ignores blank rows,
 * and extracts the first 3-5 rows for live modal preview.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheetResult> {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      if (data.length === 0) {
        throw new Error('The uploaded file is empty.');
      }

      const workbook = XLSX.read(data, {
        type: 'array',
        cellDates: true,
        cellText: false,
        raw: false,
        dense: false,
      });

      const sheetNames = workbook.SheetNames || [];
      if (sheetNames.length === 0) {
        throw new Error('No valid sheets found in this spreadsheet.');
      }

      // Pick the first non-empty sheet
      let targetSheetName = sheetNames[0];
      let worksheet = workbook.Sheets[targetSheetName];

      for (const name of sheetNames) {
        const s = workbook.Sheets[name];
        if (s && s['!ref']) {
          targetSheetName = name;
          worksheet = s;
          break;
        }
      }

      if (!worksheet || !worksheet['!ref']) {
        throw new Error('Spreadsheet worksheet has no data cells.');
      }

      // Read raw JSON rows using header: 1 (array of arrays) for maximum header flexibility
      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false,
        raw: false,
      });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('Spreadsheet has no rows of data.');
      }

      // Find first row with non-empty cells to use as headers
      let headerRowIndex = 0;
      while (
        headerRowIndex < rawRows.length &&
        (!rawRows[headerRowIndex] || rawRows[headerRowIndex].every((c) => !cleanCellValue(c)))
      ) {
        headerRowIndex++;
      }

      if (headerRowIndex >= rawRows.length) {
        throw new Error('Could not identify header columns in spreadsheet.');
      }

      const rawHeaders = rawRows[headerRowIndex] || [];
      const headers: string[] = [];
      const headerIndexMap: number[] = [];

      rawHeaders.forEach((h: any, idx: number) => {
        const cleaned = cleanCellValue(h);
        if (cleaned) {
          // Disambiguate duplicate headers
          let finalHeader = cleaned;
          let counter = 1;
          while (headers.includes(finalHeader)) {
            finalHeader = `${cleaned} (${counter++})`;
          }
          headers.push(finalHeader);
          headerIndexMap.push(idx);
        }
      });

      if (headers.length === 0) {
        throw new Error('Spreadsheet headers could not be found. Please ensure row 1 contains column names.');
      }

      // Parse remaining rows into string key-value records
      const records: Record<string, string>[] = [];

      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const record: Record<string, string> = {};
        let hasAnyValue = false;

        headers.forEach((h, i) => {
          const colIdx = headerIndexMap[i];
          const rawVal = colIdx !== undefined ? row[colIdx] : '';
          const val = cleanCellValue(rawVal);
          record[h] = val;
          if (val) hasAnyValue = true;
        });

        // Skip completely blank rows
        if (hasAnyValue) {
          records.push(record);
        }
      }

      if (records.length === 0) {
        throw new Error('Spreadsheet has header columns, but no recipient data rows were found below the header.');
      }

      const previewRows = records.slice(0, 5);

      resolve({
        sheetName: targetSheetName,
        allSheetNames: sheetNames,
        headers,
        records,
        totalRows: records.length,
        previewRows,
      });
    } catch (err: any) {
      console.error('Spreadsheet parse error:', err);
      reject(new Error(err?.message || 'Failed to read file. Please ensure it is a valid Excel or CSV spreadsheet.'));
    }
  });
}

/**
 * Intelligent fuzzy matching heuristics for mapping Excel headers to standard certificate fields.
 */
export function suggestColumnMatch(fieldName: string, availableColumns: string[]): string {
  if (availableColumns.length === 0) return '';

  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = clean(fieldName);

  // Exact match
  for (const col of availableColumns) {
    if (clean(col) === target) return col;
  }

  // Keywords dictionary
  const patterns: { keywords: string[]; matchAgainst: string[] }[] = [
    {
      keywords: [
        'full name',
        'fullname',
        'student name',
        'candidate name',
        'participant name',
        'attendee name',
        'recipient name',
        'learner name',
        'first name',
        'firstname',
        'candidate',
        'participant',
        'student',
        'attendee',
        'learner',
        'person',
        'name',
      ],
      matchAgainst: ['fullname', 'name', 'recipientname', 'studentname', 'candidatename', 'full_name'],
    },
    {
      keywords: [
        'email address',
        'emailaddress',
        'recipient email',
        'student email',
        'e-mail',
        'mail address',
        'mail',
        'email',
      ],
      matchAgainst: ['email', 'emailaddress', 'recipientemail', 'mail', 'e_mail'],
    },
    {
      keywords: [
        'certificate id',
        'cert id',
        'certid',
        'registration id',
        'reg id',
        'serial no',
        'serial number',
        'roll no',
        'roll number',
        'code',
        'id',
      ],
      matchAgainst: ['certid', 'certificateid', 'serial', 'id', 'reg_id', 'cert_id'],
    },
    {
      keywords: [
        'course name',
        'course title',
        'program name',
        'workshop name',
        'event name',
        'course',
        'program',
        'workshop',
        'track',
        'topic',
        'subject',
        'event',
      ],
      matchAgainst: ['coursename', 'course', 'program', 'workshop', 'event', 'course_name'],
    },
    {
      keywords: [
        'organization name',
        'company name',
        'institute name',
        'academy name',
        'university',
        'college',
        'organization',
        'institute',
        'academy',
        'company',
        'org',
      ],
      matchAgainst: ['orgname', 'organization', 'organizationname', 'company', 'institute', 'org_name'],
    },
    {
      keywords: ['issue date', 'date of issue', 'issued date', 'issue', 'date'],
      matchAgainst: ['issuedate', 'date', 'issue_date'],
    },
    {
      keywords: ['completion date', 'end date', 'finish date', 'completed'],
      matchAgainst: ['completiondate', 'completed', 'completion_date'],
    },
    {
      keywords: ['designation', 'job title', 'role', 'position', 'department'],
      matchAgainst: ['designation', 'role', 'title', 'position'],
    },
  ];

  // Check matching rules
  for (const pat of patterns) {
    if (pat.matchAgainst.includes(target) || pat.keywords.some((kw) => target.includes(clean(kw)))) {
      // Find highest priority column that matches pattern keywords
      for (const kw of pat.keywords) {
        const found = availableColumns.find((c) => {
          const cClean = clean(c);
          const kwClean = clean(kw);
          return cClean === kwClean || cClean.includes(kwClean);
        });
        if (found) return found;
      }
    }
  }

  // Broad substring match
  for (const col of availableColumns) {
    const cClean = clean(col);
    if (cClean.includes(target) || target.includes(cClean)) {
      return col;
    }
  }

  return '';
}

// Simple email regex validation
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate recipient records against active column mappings.
 * Features smart fallback detection: If a mapped column was not set or has slight mismatch,
 * it inspects row values for candidate name columns to prevent false "Missing Names" reports!
 */
export function validateRecipients(
  records: Record<string, string>[],
  fields: FieldConfig[],
  selectedColumns?: string[]
): {
  validatedRecords: RecipientRecord[];
  summary: ValidationSummary;
} {
  const idMap = new Map<string, number>();
  const validatedRecords: RecipientRecord[] = [];
  const errorsList: { rowNumber: number; errors: string[] }[] = [];

  let missingNames = 0;
  let missingEmails = 0;
  let duplicateIds = 0;

  // Identify mapped fields
  const nameField = fields.find((f) => f.type === 'full_name');
  const idField = fields.find((f) => f.type === 'cert_id');
  const emailField = fields.find((f) => f.type === 'email');

  const unmappedFields: string[] = fields
    .filter((f) => !f.mappedColumn)
    .map((f) => f.label);

  records.forEach((row, index) => {
    const errors: string[] = [];

    // 1. Check Full Name (with smart fallback if mapped column isn't found)
    let foundName = '';
    if (nameField && nameField.mappedColumn && row[nameField.mappedColumn] !== undefined) {
      foundName = String(row[nameField.mappedColumn] || '').trim();
    }

    // Smart fallback if mapped column is blank or empty: check alternative name columns
    if (!foundName) {
      const candidateKeys = Object.keys(row).filter((k) => {
        const lk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return (
          lk.includes('name') ||
          lk.includes('candidate') ||
          lk.includes('student') ||
          lk.includes('participant') ||
          lk.includes('attendee') ||
          lk.includes('recipient')
        );
      });

      for (const k of candidateKeys) {
        if (row[k] && String(row[k]).trim()) {
          foundName = String(row[k]).trim();
          break;
        }
      }
    }

    if (!foundName) {
      errors.push(
        nameField && nameField.mappedColumn
          ? `Missing recipient name in column "${nameField.mappedColumn}"`
          : 'Missing recipient name in record'
      );
      missingNames++;
    }

    // 2. Check Email (if mapped or present in record)
    let emailValue = '';
    if (emailField && emailField.mappedColumn && row[emailField.mappedColumn] !== undefined) {
      emailValue = String(row[emailField.mappedColumn] || '').trim();
    } else {
      const emailKey = Object.keys(row).find((k) => {
        const lk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        return lk.includes('email') || lk === 'mail';
      });
      if (emailKey && row[emailKey]) {
        emailValue = String(row[emailKey] || '').trim();
      }
    }

    if (emailValue) {
      if (!isValidEmail(emailValue)) {
        errors.push(`Invalid email address format: "${emailValue}"`);
      }
    } else if (emailField && emailField.mappedColumn) {
      missingEmails++;
    }

    // 3. Check Certificate ID duplicate
    if (idField && idField.mappedColumn && row[idField.mappedColumn] !== undefined) {
      const val = String(row[idField.mappedColumn] || '').trim();
      if (val) {
        if (idMap.has(val)) {
          errors.push(`Duplicate Certificate ID: "${val}" (already on row ${idMap.get(val)})`);
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

    // Filter row data if selectedColumns provided
    let cleanRowData = row;
    if (selectedColumns && selectedColumns.length > 0) {
      cleanRowData = {};
      selectedColumns.forEach((col) => {
        if (row[col] !== undefined) {
          cleanRowData[col] = row[col];
        }
      });
      // Ensure mapped name/email are preserved
      if (nameField?.mappedColumn && row[nameField.mappedColumn] !== undefined) {
        cleanRowData[nameField.mappedColumn] = row[nameField.mappedColumn];
      }
      if (emailField?.mappedColumn && row[emailField.mappedColumn] !== undefined) {
        cleanRowData[emailField.mappedColumn] = row[emailField.mappedColumn];
      }
    }

    validatedRecords.push({
      id: `rec_${index + 1}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      data: cleanRowData,
      email: emailValue || undefined,
      isValid,
      validationErrors: errors,
      status: 'pending',
      emailStatus: 'idle',
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
      missingEmails,
      duplicateIds,
      unmappedFields,
      errorsList,
    },
  };
}

// Download Sample CSV template with Email column
export function downloadSampleCsv() {
  const headers = ['Full Name', 'Email', 'Certificate ID', 'Course Name', 'Organization Name', 'Issue Date', 'Designation'];
  const sampleRows = [
    ['Rahul Patil', 'rahul.patil@example.com', 'CERT-001', 'Full Stack Web Development & Cloud Systems', 'Apex Institute', '10 Oct 2026', 'Software Engineer'],
    ['Priya Sharma', 'priya.sharma@example.com', 'CERT-002', 'Full Stack Web Development & Cloud Systems', 'Apex Institute', '10 Oct 2026', 'Data Analyst'],
    ['Amit Deshmukh', 'amit.deshmukh@example.com', 'CERT-003', 'Full Stack Web Development & Cloud Systems', 'Apex Institute', '10 Oct 2026', 'Solutions Architect'],
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

// Export recipient generation and email delivery report as CSV
export function exportGenerationReportCsv(recipients: RecipientRecord[], projectName: string) {
  if (recipients.length === 0) return;

  const dataKeys = Object.keys(recipients[0]?.data || {});
  const headers = [
    ...dataKeys,
    'Recipient Email',
    'Generation Status',
    'Generated Filename',
    'Email Delivery Status',
    'Email Timestamp',
    'Email Error / Details',
  ];

  const rows = recipients.map((r) => {
    const dataVals = dataKeys.map((k) => `"${(r.data[k] || '').replace(/"/g, '""')}"`);
    const emailVal = `"${(r.email || '').replace(/"/g, '""')}"`;
    const statusVal = `"${r.status}"`;
    const fileVal = `"${(r.generatedFileName || '').replace(/"/g, '""')}"`;
    const emailStatusVal = `"${r.emailStatus || 'idle'}"`;
    const emailTimeVal = `"${(r.emailSentAt || '').replace(/"/g, '""')}"`;
    const errVal = `"${(r.emailError || r.errorMessage || r.validationErrors.join('; ')).replace(/"/g, '""')}"`;
    return [...dataVals, emailVal, statusVal, fileVal, emailStatusVal, emailTimeVal, errVal].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Generation_and_Email_Report.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
