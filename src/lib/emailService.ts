import {
  EmailTemplateConfig,
  EmailProviderConfig,
  EmailSmtpConfig,
} from '../types/certificate';

export const DEFAULT_EMAIL_TEMPLATE: EmailTemplateConfig = {
  subject: 'Congratulations {{name}}! Your Certificate for {{course}} is Ready',
  body: `Dear {{name}},

Congratulations on successfully completing {{course}}!

We are thrilled to present your official Certificate of Achievement. Your unique Certificate ID is: {{certificate_id}}.

Your personalized certificate has been generated and is attached to this email for your records. Feel free to share it on LinkedIn or add it to your professional portfolio.

Warm regards,
Certification Board
{{organization}}`,
  senderName: 'CertiFlow Certification Authority',
  senderEmail: 'certificates@certiflow.app',
  attachPdf: true,
  attachPng: false,
};

export const DEFAULT_PROVIDER_CONFIG: EmailProviderConfig = {
  providerType: 'resend',
  resendApiKey: '',
  resendFrom: 'CertiFlow Certificates <onboarding@resend.dev>',
  gmailUser: '',
  gmailAppPassword: '',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: '',
  smtpPass: '',
  fromName: 'CertiFlow Certificates',
  fromEmail: 'onboarding@resend.dev',
  rateLimitDelayMs: 1500, // 1.5s delay to respect provider rate limits (1-2s minimum)
  batchSize: 5,
  maxRetries: 1,
};

// Legacy alias for backwards compatibility
export const DEFAULT_SMTP_CONFIG: EmailSmtpConfig = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  user: '',
  pass: '',
  from: 'CertiFlow <certificates@certiflow.app>',
  rateLimitDelayMs: 1500,
  batchSize: 3,
};

/**
 * Interpolates email template text with dynamic recipient properties.
 * Supports {{name}}, {{full_name}}, {{course}}, {{certificate_id}}, {{date}}, {{organization}}, etc.
 */
export function interpolateEmailTemplate(
  text: string,
  recipientData: Record<string, string>
): string {
  if (!text) return '';

  let result = text;

  // Normalizer dictionary
  const mappings: Record<string, string> = {};

  Object.entries(recipientData).forEach(([key, val]) => {
    const rawVal = String(val || '');
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');

    mappings[cleanKey] = rawVal;
    mappings[key.toLowerCase()] = rawVal;

    // Direct exact replacements
    const regex = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'gi');
    result = result.replace(regex, rawVal);
  });

  // Common aliases
  const aliasRules: [string[], string[]][] = [
    [['name', 'fullname', 'recipient', 'student'], ['Full Name', 'Name', 'fullName', 'Recipient Name']],
    [['course', 'coursename', 'program', 'workshop'], ['Course Name', 'Course', 'courseName', 'Program']],
    [['id', 'certid', 'certificateid', 'certificateno'], ['Certificate ID', 'Cert ID', 'certId', 'ID']],
    [['date', 'issuedate'], ['Issue Date', 'Date', 'issueDate']],
    [['org', 'organization', 'organizationname'], ['Organization Name', 'Organization', 'orgName']],
  ];

  aliasRules.forEach(([aliases, dataKeys]) => {
    let resolvedVal = '';
    for (const dk of dataKeys) {
      if (recipientData[dk]) {
        resolvedVal = recipientData[dk];
        break;
      }
    }
    if (resolvedVal) {
      aliases.forEach((alias) => {
        const regex = new RegExp(`{{\\s*${alias}\\s*}}`, 'gi');
        result = result.replace(regex, resolvedVal);
      });
    }
  });

  return result;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface EmailAttachmentPayload {
  filename: string;
  contentBase64: string;
  contentType: string;
}

export interface SendEmailPayload {
  to: string;
  recipientName: string;
  subject: string;
  body: string;
  attachments?: EmailAttachmentPayload[];
  providerConfig?: EmailProviderConfig;
  smtpConfig?: EmailSmtpConfig;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
  simulated?: boolean;
  statusCode?: number;
  isTestingModeRestriction?: boolean;
  rawProviderError?: any;
  recipient?: string;
}

/**
 * Sends a single email via Express backend API with provider routing.
 */
export async function sendEmailViaApi(payload: SendEmailPayload): Promise<SendEmailResult> {
  try {
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.json().catch(() => ({}));

    // Log the full raw response body in the browser console for instant diagnosis
    console.info(`[Email Dispatcher Raw Response HTTP ${response.status}] to ${payload.to}:`, responseBody);

    if (response.ok && responseBody.success !== false) {
      return {
        ...responseBody,
        success: true,
      };
    } else {
      const is403 =
        response.status === 403 ||
        responseBody.statusCode === 403 ||
        Boolean(responseBody.isTestingModeRestriction);

      const rawMsg = String(responseBody.error || responseBody.message || responseBody.rawMessage || '');
      const isTestingBlock =
        is403 ||
        /testing email|only send|own email|domain.*not.*verified|sandbox/i.test(rawMsg);

      let formattedError = rawMsg;
      if (isTestingBlock) {
        formattedError =
          responseBody.error ||
          'Testing Mode Restriction Detected: Your email provider only allows sending to your account email. To send bulk emails to external recipients, you must add and verify your custom domain, OR switch to a standard SMTP / Gmail relay.';
      } else if (!formattedError) {
        formattedError = `HTTP ${response.status}: Failed to dispatch email.`;
      }

      return {
        success: false,
        error: formattedError,
        statusCode: response.status,
        isTestingModeRestriction: isTestingBlock,
        rawProviderError: responseBody.rawProviderError || responseBody,
        recipient: payload.to,
        provider: responseBody.provider,
      };
    }
  } catch (err: any) {
    console.error('[Email Dispatcher Network Error]', err);
    return {
      success: false,
      error: `Network error connecting to email dispatcher: ${err?.message || 'Server connection failed'}`,
      rawProviderError: err,
    };
  }
}

/**
 * Tests connection to Email Provider (Resend API Key, Gmail Preset, or Custom SMTP).
 */
export async function testProviderConnection(
  config: EmailProviderConfig | EmailSmtpConfig
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('/api/email/test-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    const data = await response.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to reach email provider endpoint.',
    };
  }
}

// Backwards-compatible alias
export const testSmtpConnection = testProviderConnection;
