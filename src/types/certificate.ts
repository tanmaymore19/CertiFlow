export type DynamicFieldType =
  | 'full_name'
  | 'cert_id'
  | 'course_name'
  | 'org_name'
  | 'issue_date'
  | 'completion_date'
  | 'designation'
  | 'email'
  | 'custom';

export type SupportedFontFamily = 'Helvetica' | 'TimesRoman' | 'Courier';

export interface FieldConfig {
  id: string;
  label: string;
  type: DynamicFieldType;
  mappedColumn: string;
  sampleValue: string;
  xPercent: number; // 0 - 100 percentage from left
  yPercent: number; // 0 - 100 percentage from top
  widthPercent: number; // 5 - 100 percentage width of text container
  fontFamily: SupportedFontFamily;
  fontSize: number; // 10 - 72 (defined relative to REFERENCE_BASE_WIDTH = 1200)
  fontColor: string; // Hex color string, e.g. #1e293b
  textAlign: 'left' | 'center' | 'right';
  isBold: boolean;
  isItalic: boolean;
  textTransform: 'none' | 'uppercase' | 'capitalize';
  autoScale: boolean; // Auto scale font size down if text exceeds width
}

export interface CertificateTemplate {
  name: string;
  type: 'image' | 'pdf';
  mimeType: string;
  dataUrl: string; // Base64 data URI
  pageNumber: number; // 1-indexed
  pageCount: number;
  width: number; // in pt or pixels
  height: number;
  orientation: 'landscape' | 'portrait';
}

export interface RecipientRecord {
  id: string;
  data: Record<string, string>;
  isValid: boolean;
  validationErrors: string[];
  status: 'pending' | 'success' | 'failed';
  generatedFileName?: string;
  errorMessage?: string;
  pdfBlobUrl?: string;
  // Email distribution tracking
  email?: string;
  emailStatus?: 'idle' | 'queued' | 'sending' | 'sent' | 'failed';
  emailSentAt?: string;
  emailError?: string;
}

export type ProjectStatus = 'draft' | 'ready' | 'processing' | 'completed' | 'failed';

export interface EmailTemplateConfig {
  subject: string;
  body: string;
  senderName: string;
  senderEmail: string;
  attachPdf: boolean;
  attachPng: boolean;
}

export type EmailProviderType = 'resend' | 'gmail' | 'custom_smtp' | 'simulation';

export interface EmailProviderConfig {
  providerType: EmailProviderType;
  // Resend API (Recommended - REST API)
  resendApiKey?: string;
  resendFrom?: string; // e.g. "CertiFlow <onboarding@resend.dev>" or verified domain
  // Gmail Preset (Google App Password)
  gmailUser?: string;
  gmailAppPassword?: string;
  // Custom SMTP
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  // Common details
  fromName?: string;
  fromEmail?: string;
  rateLimitDelayMs: number;
  batchSize: number;
  maxRetries?: number; // 0, 1, or 2 retries
}

export interface EmailSmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  rateLimitDelayMs: number;
  batchSize: number;
}

export interface CertificateProject {
  id: string;
  userId: string;
  userEmail: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  template: CertificateTemplate | null;
  fields: FieldConfig[];
  recipients: RecipientRecord[];
  recipientCount: number;
  generatedCount: number;
  failedCount: number;
  emailConfig?: EmailTemplateConfig;
  smtpConfig?: EmailSmtpConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  missingNames: number;
  missingEmails: number;
  duplicateIds: number;
  unmappedFields: string[];
  errorsList: { rowNumber: number; errors: string[] }[];
}
