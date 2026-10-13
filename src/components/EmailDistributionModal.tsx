import React, { useState, useRef } from 'react';
import {
  Mail,
  Send,
  X,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Eye,
  Settings,
  Paperclip,
  Check,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Info,
  ExternalLink,
  Zap,
  Lock,
  Download,
} from 'lucide-react';
import {
  CertificateTemplate,
  FieldConfig,
  RecipientRecord,
  EmailTemplateConfig,
  EmailProviderConfig,
  EmailProviderType,
} from '../types/certificate';
import {
  DEFAULT_EMAIL_TEMPLATE,
  DEFAULT_PROVIDER_CONFIG,
  interpolateEmailTemplate,
  sendEmailViaApi,
  testProviderConnection,
  EmailAttachmentPayload,
} from '../lib/emailService';
import {
  generateSingleCertificatePdf,
  generateSingleCertificatePng,
  generateCertificateFileName,
  blobToBase64,
} from '../lib/pdfEngine';
import { exportGenerationReportCsv } from '../lib/spreadsheet';

interface EmailDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: CertificateTemplate;
  fields: FieldConfig[];
  recipients: RecipientRecord[];
  projectName: string;
  onUpdateRecipients: (updatedRecipients: RecipientRecord[]) => void;
}

export const EmailDistributionModal: React.FC<EmailDistributionModalProps> = ({
  isOpen,
  onClose,
  template,
  fields,
  recipients,
  projectName,
  onUpdateRecipients,
}) => {
  const [activeTab, setActiveTab] = useState<'template' | 'settings' | 'dispatch'>('settings');

  // Email template config
  const [emailConfig, setEmailConfig] = useState<EmailTemplateConfig>(DEFAULT_EMAIL_TEMPLATE);

  // Email Provider Settings (Dual Provider: Resend API + Gmail App Password + Simulation)
  const [providerConfig, setProviderConfig] = useState<EmailProviderConfig>(DEFAULT_PROVIDER_CONFIG);
  const [showPassword, setShowPassword] = useState(false);
  const [providerTesting, setProviderTesting] = useState(false);
  const [providerTestResult, setProviderTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Preview recipient selection
  const [previewRecipientIndex, setPreviewRecipientIndex] = useState(0);

  // Dispatch state
  const [isSending, setIsSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [shouldCancel, setShouldCancel] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentRecipientName, setCurrentRecipientName] = useState('');
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [logs, setLogs] = useState<{ time: string; text: string; type: 'info' | 'success' | 'error' }[]>([]);
  const [copiedLog, setCopiedLog] = useState(false);

  // Testing mode detection & raw diagnostics
  const [testingModeDetected, setTestingModeDetected] = useState(false);
  const [testingModeErrorDetails, setTestingModeErrorDetails] = useState<string | null>(null);

  const pauseRef = useRef(isPaused);
  pauseRef.current = isPaused;

  const cancelRef = useRef(shouldCancel);
  cancelRef.current = shouldCancel;

  if (!isOpen) return null;

  const previewRecipient = recipients[previewRecipientIndex] || recipients[0];

  const renderedSubject = previewRecipient
    ? interpolateEmailTemplate(emailConfig.subject, previewRecipient.data)
    : emailConfig.subject;

  const renderedBody = previewRecipient
    ? interpolateEmailTemplate(emailConfig.body, previewRecipient.data)
    : emailConfig.body;

  const validEmailRecipients = recipients.filter(
    (r) => r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())
  );

  const addLog = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [{ time, text, type }, ...prev.slice(0, 70)]);
  };

  // Test provider connection
  const handleTestProvider = async () => {
    setProviderTesting(true);
    setProviderTestResult(null);
    try {
      const result = await testProviderConnection(providerConfig);
      setProviderTestResult(result);
      if (result.success) {
        addLog(`Provider verified: ${result.message}`, 'success');
      } else {
        addLog(`Provider verification failed: ${result.message}`, 'error');
      }
    } catch (err: any) {
      setProviderTestResult({
        success: false,
        message: err?.message || 'Connection test failed.',
      });
      addLog(`Verification error: ${err?.message}`, 'error');
    } finally {
      setProviderTesting(false);
    }
  };

  // Insert template placeholder tag
  const handleInsertTag = (tag: string) => {
    setEmailConfig((prev) => ({
      ...prev,
      body: prev.body + ` {{${tag}}}`,
    }));
  };

  // Switch to Option B (Gmail Relay) with zero domain restrictions
  const handleSwitchToGmailPreset = () => {
    setProviderConfig((prev) => ({
      ...prev,
      providerType: 'gmail',
      rateLimitDelayMs: 1500,
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: true,
    }));
    setActiveTab('settings');
    addLog(
      'Switched to Option B: Direct Gmail Relay (zero domain restrictions). Please enter your Gmail and 16-character App Password.',
      'info'
    );
  };

  // Quick fallback retry using Gmail
  const handleRetryFailedWithGmail = (overrideConfig?: EmailProviderConfig) => {
    const activeCfg: EmailProviderConfig = overrideConfig || {
      ...providerConfig,
      providerType: 'gmail',
      rateLimitDelayMs: 1500,
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: true,
    };
    setProviderConfig(activeCfg);
    const failedRecipients = recipients.filter((r) => r.emailStatus === 'failed');
    if (failedRecipients.length > 0) {
      addLog(
        `Retrying delivery for ${failedRecipients.length} failed recipient(s) using Gmail Relay fallback...`,
        'info'
      );
      handleStartDispatch(failedRecipients, activeCfg);
    }
  };

  // Start automated email distribution pipeline with auto-retry
  const handleStartDispatch = async (
    targetRecipients = recipients,
    overrideConfig?: EmailProviderConfig
  ) => {
    const activeConfig = overrideConfig || providerConfig;
    const recipientsToSend = targetRecipients.filter(
      (r) => r.email && r.isValid && r.emailStatus !== 'sent'
    );

    if (recipientsToSend.length === 0) {
      addLog('No eligible recipients with valid email addresses found to send.', 'error');
      return;
    }

    setIsSending(true);
    setIsPaused(false);
    setShouldCancel(false);
    setActiveTab('dispatch');

    const providerName =
      activeConfig.providerType === 'resend'
        ? 'Option A: Resend REST API (HTTPS)'
        : activeConfig.providerType === 'gmail'
        ? 'Option B: Direct Gmail SMTP Relay'
        : activeConfig.providerType === 'simulation'
        ? 'Option C: Simulation Engine'
        : 'Custom SMTP Relay';

    addLog(
      `Initiating bulk email dispatch for ${recipientsToSend.length} recipients using ${providerName} (Interval: ${activeConfig.rateLimitDelayMs || 1500}ms)...`,
      'info'
    );

    let updatedList = [...recipients];
    const maxRetries = activeConfig.maxRetries ?? 1;

    for (let i = 0; i < recipientsToSend.length; i++) {
      // Check for user cancellation
      if (cancelRef.current) {
        addLog('Bulk email delivery halted by user.', 'error');
        break;
      }

      // Check for pause
      while (pauseRef.current) {
        await new Promise((r) => setTimeout(r, 400));
        if (cancelRef.current) break;
      }

      if (cancelRef.current) break;

      const recipient = recipientsToSend[i];
      setCurrentIndex(i + 1);

      const targetEmail = recipient.email!.trim();
      const recipientName =
        recipient.data['Full Name'] ||
        recipient.data['Name'] ||
        Object.values(recipient.data)[0] ||
        'Recipient';
      setCurrentRecipientName(recipientName);

      // Update state to 'sending'
      updatedList = updatedList.map((r) =>
        r.id === recipient.id ? { ...r, emailStatus: 'sending' } : r
      );
      onUpdateRecipients(updatedList);

      let sendSuccess = false;
      let lastError = '';
      let deliveredMessageId = '';
      let isSimulated = false;

      // Generate attachments once per recipient
      let attachments: EmailAttachmentPayload[] = [];
      try {
        if (emailConfig.attachPdf) {
          const pdfBlob = await generateSingleCertificatePdf(template, fields, recipient.data);
          const pdfFileName = generateCertificateFileName(recipient.data, projectName, i, 'pdf');
          const pdfBase64 = await blobToBase64(pdfBlob);
          attachments.push({
            filename: pdfFileName,
            contentBase64: pdfBase64,
            contentType: 'application/pdf',
          });
        }

        if (emailConfig.attachPng) {
          const pngBlob = await generateSingleCertificatePng(template, fields, recipient.data, 1920);
          const pngFileName = generateCertificateFileName(recipient.data, projectName, i, 'png');
          const pngBase64 = await blobToBase64(pngBlob);
          attachments.push({
            filename: pngFileName,
            contentBase64: pngBase64,
            contentType: 'image/png',
          });
        }
      } catch (attErr: any) {
        console.error('Failed to generate attachments:', attErr);
        lastError = `Attachment render error: ${attErr?.message || 'PDF render failed'}`;
      }

      // If attachments succeeded, proceed with sending and automated retries
      if (!lastError) {
        const subject = interpolateEmailTemplate(emailConfig.subject, recipient.data);
        const body = interpolateEmailTemplate(emailConfig.body, recipient.data);

        // Attempt sending with automatic retry mechanism (up to maxRetries)
        const maxAttempts = 1 + maxRetries;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (cancelRef.current) break;
          setCurrentAttempt(attempt);

          if (attempt > 1) {
            addLog(`Retrying ${recipientName} <${targetEmail}> (Attempt ${attempt}/${maxAttempts})...`, 'info');
            // Backoff delay before retry
            await new Promise((r) => setTimeout(r, 1200 * attempt));
          } else {
            addLog(`Sending certificate to ${recipientName} <${targetEmail}>...`, 'info');
          }

          try {
            const sendResult = await sendEmailViaApi({
              to: targetEmail,
              recipientName,
              subject,
              body,
              attachments,
              providerConfig: activeConfig,
            });

            if (sendResult.success) {
              sendSuccess = true;
              deliveredMessageId = sendResult.messageId || '';
              isSimulated = Boolean(sendResult.simulated);
              break;
            } else {
              lastError = sendResult.error || 'Email dispatch failed';

              // If it's a 403 test-mode domain restriction or fatal credential failure
              if (
                sendResult.isTestingModeRestriction ||
                sendResult.statusCode === 403 ||
                lastError.includes('Testing Mode Restriction') ||
                lastError.includes('Authentication Failed') ||
                lastError.includes('Invalid Resend API Key') ||
                lastError.includes('Domain not verified')
              ) {
                if (
                  sendResult.isTestingModeRestriction ||
                  sendResult.statusCode === 403 ||
                  lastError.includes('Testing Mode')
                ) {
                  setTestingModeDetected(true);
                  setTestingModeErrorDetails(lastError);
                  addLog(
                    `[HTTP 403 Test Mode Block] ${targetEmail}: Blocked by provider. External recipients require verified domain or Gmail relay.`,
                    'error'
                  );
                }
                // Do not retry repeatedly when blocked by domain restriction
                break;
              }
            }
          } catch (err: any) {
            lastError = err?.message || 'Network dispatch failure';
          }
        }
      }

      // Update recipient delivery status
      if (sendSuccess) {
        addLog(
          `Delivered to ${targetEmail} ${isSimulated ? '(Simulation)' : `[ID: ${deliveredMessageId.substring(0, 14)}...]`}`,
          'success'
        );
        updatedList = updatedList.map((r) =>
          r.id === recipient.id
            ? {
                ...r,
                emailStatus: 'sent',
                emailSentAt: new Date().toLocaleTimeString(),
                emailError: undefined,
              }
            : r
        );
      } else {
        addLog(`Failed for ${targetEmail}: ${lastError}`, 'error');
        updatedList = updatedList.map((r) =>
          r.id === recipient.id
            ? {
                ...r,
                emailStatus: 'failed',
                emailError: lastError,
              }
            : r
        );
      }

      onUpdateRecipients(updatedList);

      // Throttling & Batch Cooldown: Enforce explicit delay (at least 1.5s) between API calls
      if (i < recipientsToSend.length - 1 && !cancelRef.current) {
        const delay = Math.max(1200, activeConfig.rateLimitDelayMs || 1500);
        await new Promise((r) => setTimeout(r, delay));

        // Batch pause if batch limit reached
        const batchSize = activeConfig.batchSize || 5;
        if ((i + 1) % batchSize === 0) {
          addLog(
            `Batch checkpoint reached (${i + 1} processed). Pausing 2s to maintain provider rate limits...`,
            'info'
          );
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    setIsSending(false);
    setIsPaused(false);
    setShouldCancel(false);
    setCurrentAttempt(1);
    addLog('Bulk email delivery sequence completed.', 'info');
  };

  const sentCount = recipients.filter((r) => r.emailStatus === 'sent').length;
  const failedCount = recipients.filter((r) => r.emailStatus === 'failed').length;
  const pendingCount = recipients.filter(
    (r) => r.email && r.emailStatus !== 'sent' && r.emailStatus !== 'failed'
  ).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-slate-900">
                  Bulk Email Distribution Engine
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center space-x-1">
                  <Zap className="w-2.5 h-2.5" />
                  <span>
                    {providerConfig.providerType === 'resend'
                      ? 'Email API (HTTPS)'
                      : providerConfig.providerType === 'gmail'
                      ? 'Gmail Preset'
                      : providerConfig.providerType === 'simulation'
                      ? 'Demo Simulation'
                      : 'Custom SMTP'}
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Dispatch personalized certificates directly to {validEmailRecipients.length} recipients with auto-retry and rate limiting.
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

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50 px-5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Email Provider & Delivery Setup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('template')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'template'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Template & Live Preview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dispatch')}
            className={`py-3 px-4 border-b-2 flex items-center space-x-2 transition ${
              activeTab === 'dispatch'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Delivery Queue & Status</span>
            {(sentCount > 0 || failedCount > 0) && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800">
                {sentCount}/{recipients.length}
              </span>
            )}
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: PROVIDER SETUP (Dual Provider + Settings) */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
            {/* Testing Mode Restriction Alert Banner */}
            {(testingModeDetected || recipients.some((r) => /testing mode|403|own email/i.test(r.emailError || ''))) && (
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-start space-x-3 shadow-xs">
                <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h6 className="font-bold text-xs text-amber-900">
                    Testing Mode Restriction Detected in Email API
                  </h6>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    Your email provider only allows sending to your account email in sandbox mode. To send bulk emails to external recipients, you must add and verify your custom domain, <strong>OR switch to Option B (Direct Gmail Relay) below with zero domain restrictions</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Provider Selector Cards */}
            <div>
              <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block mb-2">
                Select Email Dispatch Provider
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Option A: Verified Domain Email API */}
                <button
                  type="button"
                  onClick={() =>
                    setProviderConfig({
                      ...providerConfig,
                      providerType: 'resend',
                      rateLimitDelayMs: 1500,
                    })
                  }
                  className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                    providerConfig.providerType === 'resend'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                        <Zap className="w-4 h-4 text-indigo-600" />
                        <span>Option A: Email API</span>
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        Resend / REST
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Standard HTTPS (Port 443). To send to external recipients, requires a verified custom domain in Resend.
                    </p>
                  </div>
                  <div className="mt-3 text-[10px] font-semibold text-slate-600 flex items-center space-x-1">
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                    <span>Requires Custom Domain</span>
                  </div>
                </button>

                {/* Option B: Direct Gmail Preset (Zero Restrictions) */}
                <button
                  type="button"
                  onClick={() =>
                    setProviderConfig({
                      ...providerConfig,
                      providerType: 'gmail',
                      rateLimitDelayMs: 1500,
                    })
                  }
                  className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                    providerConfig.providerType === 'gmail'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                        <Mail className="w-4 h-4 text-rose-500" />
                        <span>Option B: Gmail Relay</span>
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Zero Restrictions
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Direct Gmail relay with Google App Password. Sends directly to ANY external email without domain verification.
                    </p>
                  </div>
                  <div className="mt-3 text-[10px] font-semibold text-emerald-700 flex items-center space-x-1">
                    <Check className="w-3 h-3" />
                    <span>Recommended for Bulk</span>
                  </div>
                </button>

                {/* Option C: Simulation Demo */}
                <button
                  type="button"
                  onClick={() =>
                    setProviderConfig({
                      ...providerConfig,
                      providerType: 'simulation',
                    })
                  }
                  className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                    providerConfig.providerType === 'simulation'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>Option C: Demo</span>
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        Zero Config
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Test batching, PDF mapping, and audit logs immediately without external credentials.
                    </p>
                  </div>
                  <div className="mt-3 text-[10px] font-semibold text-amber-700 flex items-center space-x-1">
                    <Check className="w-3 h-3" />
                    <span>Instant Local Test</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Provider Configuration Forms */}
            {providerConfig.providerType === 'resend' && (
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">Resend API Configuration</h5>
                    <p className="text-[11px] text-slate-500">
                      Uses standard HTTPS REST calls to api.resend.com. Eliminates SMTP timeouts completely.
                    </p>
                  </div>
                  <a
                    href="https://resend.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-semibold text-xs"
                  >
                    <span>Get Free API Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Resend API Key <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={providerConfig.resendApiKey || ''}
                        onChange={(e) =>
                          setProviderConfig({ ...providerConfig, resendApiKey: e.target.value })
                        }
                        placeholder="re_1234567890abcdef..."
                        className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Free tier includes 3,000 emails/month.
                    </p>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Sender &quot;From&quot; Email
                    </label>
                    <input
                      type="text"
                      value={providerConfig.resendFrom || ''}
                      onChange={(e) =>
                        setProviderConfig({ ...providerConfig, resendFrom: e.target.value })
                      }
                      placeholder="CertiFlow <onboarding@resend.dev>"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Use <code>onboarding@resend.dev</code> for instant testing, or your verified domain.
                    </p>
                  </div>
                </div>

                {/* Test Connection Button */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleTestProvider}
                    disabled={providerTesting || !providerConfig.resendApiKey}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition disabled:opacity-50"
                  >
                    {providerTesting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>{providerTesting ? 'Verifying API Key...' : 'Test Resend API Key'}</span>
                  </button>

                  {providerTestResult && (
                    <span
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${
                        providerTestResult.success
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {providerTestResult.message}
                    </span>
                  )}
                </div>
              </div>
            )}

            {providerConfig.providerType === 'gmail' && (
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">Gmail / Google Workspace Preset</h5>
                    <p className="text-[11px] text-slate-500">
                      Pre-configured with host: <code>smtp.gmail.com</code> and port: <code>465 (SSL)</code>.
                    </p>
                  </div>
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-semibold text-xs"
                  >
                    <span>Generate App Password</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Instructions Box */}
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 space-y-1.5">
                  <div className="font-bold flex items-center space-x-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-700" />
                    <span>How to create your 16-character Google App Password:</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-amber-800 pl-1">
                    <li>Enable 2-Step Verification in your Google Account.</li>
                    <li>
                      Go to{' '}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-semibold"
                      >
                        myaccount.google.com/apppasswords
                      </a>
                    </li>
                    <li>Type &quot;CertiFlow&quot; into the App name field and click <strong>Create</strong>.</li>
                    <li>Copy and paste the 16-character code below (do NOT use your standard Gmail password).</li>
                  </ol>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Gmail Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={providerConfig.gmailUser || ''}
                      onChange={(e) =>
                        setProviderConfig({ ...providerConfig, gmailUser: e.target.value })
                      }
                      placeholder="yourname@gmail.com"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      16-Character Google App Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={providerConfig.gmailAppPassword || ''}
                        onChange={(e) =>
                          setProviderConfig({ ...providerConfig, gmailAppPassword: e.target.value })
                        }
                        placeholder="abcd efgh ijkl mnop"
                        className="w-full px-3 py-2 pr-10 rounded-xl border border-slate-300 font-mono text-xs focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Test Connection Button */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleTestProvider}
                    disabled={providerTesting || !providerConfig.gmailUser || !providerConfig.gmailAppPassword}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold transition disabled:opacity-50"
                  >
                    {providerTesting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>{providerTesting ? 'Verifying Gmail SMTP...' : 'Test Gmail Connection'}</span>
                  </button>

                  {providerTestResult && (
                    <span
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl max-w-md ${
                        providerTestResult.success
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {providerTestResult.message}
                    </span>
                  )}
                </div>
              </div>
            )}

            {providerConfig.providerType === 'simulation' && (
              <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-2 text-amber-900">
                <div className="flex items-center space-x-2 font-bold text-sm text-amber-800">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Instant Demo Mode Active</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  You can test bulk certificate generation, personalized name interpolation, attachment conversion, batching, and delivery logs without inputting any external credentials. Click <strong>Proceed to Delivery</strong> below to test.
                </p>
              </div>
            )}

            {/* Advanced Bulk Queue, Throttling & Auto-Retry Controls */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
              <h5 className="font-bold text-slate-900 flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>Bulk Queue, Anti-Spam Throttling & Auto-Retry</span>
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">Interval Delay</label>
                    <span className="font-mono text-indigo-600 font-bold">
                      {providerConfig.rateLimitDelayMs} ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min="300"
                    max="4000"
                    step="100"
                    value={providerConfig.rateLimitDelayMs}
                    onChange={(e) =>
                      setProviderConfig({
                        ...providerConfig,
                        rateLimitDelayMs: Number(e.target.value),
                      })
                    }
                    className="w-full accent-indigo-600"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Pause between sends to prevent throttling.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">Batch Chunk Size</label>
                    <span className="font-mono text-indigo-600 font-bold">
                      {providerConfig.batchSize} per batch
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={providerConfig.batchSize}
                    onChange={(e) =>
                      setProviderConfig({
                        ...providerConfig,
                        batchSize: Number(e.target.value),
                      })
                    }
                    className="w-full accent-indigo-600"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Cooldown pause after every batch to prevent memory pressure.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">Auto-Retry on Failure</label>
                    <span className="font-mono text-indigo-600 font-bold">
                      {providerConfig.maxRetries ?? 2} retries
                    </span>
                  </div>
                  <select
                    value={providerConfig.maxRetries ?? 2}
                    onChange={(e) =>
                      setProviderConfig({
                        ...providerConfig,
                        maxRetries: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-medium text-xs bg-white"
                  >
                    <option value={0}>No retry (fail immediately)</option>
                    <option value={1}>Retry once (1 retry)</option>
                    <option value={2}>Recommended: 2 retries with backoff</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Automatically retries transient network errors.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab('template')}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-xs flex items-center space-x-2"
              >
                <span>Continue to Template & Preview</span>
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: EMAIL TEMPLATE & LIVE RECIPIENT PREVIEW */}
        {/* ========================================================= */}
        {activeTab === 'template' && (
          <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Template Composer */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Email Composer
                  </span>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Auto-Attaches Generated Certificate</span>
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email Subject</label>
                  <input
                    type="text"
                    value={emailConfig.subject}
                    onChange={(e) => setEmailConfig({ ...emailConfig, subject: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter subject..."
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Email Body</label>
                  <textarea
                    rows={8}
                    value={emailConfig.body}
                    onChange={(e) => setEmailConfig({ ...emailConfig, body: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-indigo-500 leading-relaxed font-sans"
                    placeholder="Enter message body..."
                  />
                </div>

                {/* Variable Tag Inserter */}
                <div>
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                    Click to insert dynamic variable tags:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['name', 'course', 'certificate_id', 'date', 'organization'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleInsertTag(tag)}
                        className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-mono font-semibold transition"
                      >
                        + &#123;&#123;{tag}&#125;&#125;
                      </button>
                    ))}
                  </div>
                </div>

                {/* Attachment toggles */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="font-semibold text-slate-700 block text-[11px]">
                    Certificate Attachments:
                  </span>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailConfig.attachPdf}
                        onChange={(e) =>
                          setEmailConfig({ ...emailConfig, attachPdf: e.target.checked })
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-semibold text-slate-700">Attach High-Res PDF</span>
                    </label>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailConfig.attachPng}
                        onChange={(e) =>
                          setEmailConfig({ ...emailConfig, attachPng: e.target.checked })
                        }
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-semibold text-slate-700">Attach PNG Image</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Recipient Preview */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Live Rendered Preview</span>
                    </span>

                    {/* Recipient Selector */}
                    {recipients.length > 0 && (
                      <select
                        value={previewRecipientIndex}
                        onChange={(e) => setPreviewRecipientIndex(Number(e.target.value))}
                        className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-medium text-[11px] max-w-[180px] truncate"
                      >
                        {recipients.map((rec, i) => {
                          const nameVal =
                            rec.data['Full Name'] ||
                            rec.data['Name'] ||
                            Object.values(rec.data)[0] ||
                            `Recipient ${i + 1}`;
                          return (
                            <option key={rec.id} value={i}>
                              #{i + 1}: {nameVal}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>

                  {/* Rendered Email Card */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
                    <div className="text-[11px] space-y-1 text-slate-500 border-b border-slate-100 pb-2">
                      <p>
                        <strong className="text-slate-700">To:</strong>{' '}
                        {previewRecipient?.email || (
                          <span className="text-amber-600 italic">No email address</span>
                        )}
                      </p>
                      <p>
                        <strong className="text-slate-700">From:</strong>{' '}
                        {providerConfig.providerType === 'resend'
                          ? providerConfig.resendFrom || 'CertiFlow Certificates <onboarding@resend.dev>'
                          : providerConfig.providerType === 'gmail'
                          ? providerConfig.gmailUser || 'yourname@gmail.com'
                          : 'certificates@certiflow.app'}
                      </p>
                      <p>
                        <strong className="text-slate-700">Subject:</strong> {renderedSubject}
                      </p>
                    </div>

                    <div className="text-slate-800 whitespace-pre-line leading-relaxed text-xs">
                      {renderedBody}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center space-x-2 text-[11px] text-slate-500">
                      <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                      <span>
                        Attached file:{' '}
                        <strong>
                          {previewRecipient
                            ? generateCertificateFileName(previewRecipient.data, projectName, 0)
                            : 'Certificate.pdf'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition"
                  >
                    Provider Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('dispatch')}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-xs flex items-center justify-center space-x-2"
                  >
                    <span>Proceed to Delivery & Dispatch</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: DISPATCH QUEUE, AUTO-RETRY & LIVE STATUS */}
        {/* ========================================================= */}
        {activeTab === 'dispatch' && (
          <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
            {/* Top Control Bar */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Automated Email Dispatcher</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {sentCount} delivered • {failedCount} failed • {pendingCount} in queue
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isSending ? (
                  <button
                    type="button"
                    onClick={() => handleStartDispatch()}
                    disabled={validEmailRecipients.length === 0}
                    className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-md shadow-indigo-500/20 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send All ({validEmailRecipients.length}) Emails</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsPaused(!isPaused)}
                      className="inline-flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold transition"
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{isPaused ? 'Resume' : 'Pause'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShouldCancel(true)}
                      className="inline-flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Stop Delivery</span>
                    </button>
                  </>
                )}

                {failedCount > 0 && !isSending && (
                  <button
                    type="button"
                    onClick={() =>
                      handleStartDispatch(recipients.filter((r) => r.emailStatus === 'failed'))
                    }
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-semibold hover:bg-amber-100 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Failed ({failedCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => exportGenerationReportCsv(recipients, projectName)}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition"
                  title="Export Delivery Report as CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Report CSV</span>
                </button>
              </div>
            </div>

            {/* Actionable Testing Mode Restriction Warning Banner */}
            {(testingModeDetected || recipients.some((r) => /testing mode|403|own email/i.test(r.emailError || ''))) && (
              <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 space-y-3 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800 shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h5 className="font-bold text-sm text-amber-900 flex items-center space-x-2">
                        <span>Testing Mode Restriction Detected</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-mono">
                          HTTP 403 Forbidden
                        </span>
                      </h5>
                      <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                        Zero-Restriction Relay Available
                      </span>
                    </div>

                    <p className="text-xs text-amber-900 leading-relaxed font-medium">
                      Testing Mode Restriction Detected: Your email provider only allows sending to your account email. To send bulk emails to external recipients, you must add and verify your custom domain, <strong>OR switch to a standard SMTP / Gmail relay</strong>.
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1.5">
                      <button
                        type="button"
                        onClick={handleSwitchToGmailPreset}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-xs"
                      >
                        <Mail className="w-3.5 h-3.5 text-rose-400" />
                        <span>Switch to Option B: Direct Gmail Relay</span>
                      </button>

                      {providerConfig.gmailUser && providerConfig.gmailAppPassword && (
                        <button
                          type="button"
                          onClick={() => handleRetryFailedWithGmail()}
                          className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry Failed with Gmail ({failedCount})</span>
                        </button>
                      )}

                      <a
                        href="https://resend.com/domains"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 font-semibold text-xs transition inline-flex items-center space-x-1"
                      >
                        <span>Verify Custom Domain in Resend</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Bar with Retry Indicator */}
            {isSending && (
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-indigo-900">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    <span>
                      Processing {currentRecipientName} ({currentIndex} of {validEmailRecipients.length})
                      {currentAttempt > 1 && (
                        <span className="ml-2 text-amber-700 font-bold">
                          [Retry attempt {currentAttempt}/{(providerConfig.maxRetries ?? 2) + 1}]
                        </span>
                      )}
                    </span>
                  </div>
                  <span>{Math.round((currentIndex / Math.max(1, validEmailRecipients.length)) * 100)}%</span>
                </div>
                <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-200"
                    style={{
                      width: `${(currentIndex / Math.max(1, validEmailRecipients.length)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Live Recipient Status Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3 border-b border-slate-100 font-bold text-slate-800 uppercase tracking-wider text-[11px] flex justify-between items-center">
                <span>Recipient Delivery Status</span>
                <span className="text-slate-500">{recipients.length} Total Recipients</span>
              </div>

              <div className="overflow-x-auto max-h-[220px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 font-semibold text-slate-600">Recipient</th>
                      <th className="py-2 px-3 font-semibold text-slate-600">Email Address</th>
                      <th className="py-2 px-3 font-semibold text-slate-600">Status</th>
                      <th className="py-2 px-3 font-semibold text-slate-600">Delivered / Error Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recipients.map((rec) => {
                      const name =
                        rec.data['Full Name'] ||
                        rec.data['Name'] ||
                        Object.values(rec.data)[0];

                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/70">
                          <td className="py-2 px-3 font-medium text-slate-900">{name}</td>
                          <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                            {rec.email || <span className="text-amber-600 italic">No email</span>}
                          </td>
                          <td className="py-2 px-3">
                            {rec.emailStatus === 'sent' && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                <Check className="w-3 h-3" />
                                <span>Delivered</span>
                              </span>
                            )}
                            {rec.emailStatus === 'sending' && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Sending...</span>
                              </span>
                            )}
                            {rec.emailStatus === 'failed' && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Failed</span>
                              </span>
                            )}
                            {(!rec.emailStatus || rec.emailStatus === 'idle' || rec.emailStatus === 'queued') && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                <span>Pending</span>
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-[11px]">
                            {rec.emailSentAt ? (
                              <span className="text-emerald-700 font-medium">Delivered at {rec.emailSentAt}</span>
                            ) : rec.emailError ? (
                              /testing mode|403|own email/i.test(rec.emailError) ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                    <ShieldAlert className="w-2.5 h-2.5 text-amber-700" />
                                    <span>Blocked by Test Mode</span>
                                  </span>
                                  <span
                                    className="text-[10px] text-rose-600 font-medium line-clamp-1 block cursor-help"
                                    title={rec.emailError}
                                  >
                                    Only account email permitted • Switch to Gmail Relay to send
                                  </span>
                                </div>
                              ) : (
                                <span className="text-rose-600 font-medium truncate max-w-sm block" title={rec.emailError}>
                                  {rec.emailError}
                                </span>
                              )
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Live Activity & Error Log */}
            <div className="bg-slate-950 text-slate-200 rounded-2xl p-4 font-mono text-[11px] space-y-2 shadow-inner">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Real-Time Dispatch Audit Log</span>
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500 text-[10px]">{logs.length} events</span>
                  {logs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const text = logs
                          .map((l) => `[${l.time}] ${l.type.toUpperCase()}: ${l.text}`)
                          .join('\n');
                        navigator.clipboard.writeText(text);
                        setCopiedLog(true);
                        setTimeout(() => setCopiedLog(false), 2000);
                      }}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition font-sans"
                    >
                      {copiedLog ? 'Copied!' : 'Copy Log'}
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {logs.length === 0 ? (
                  <p className="text-slate-600 italic">Queue ready. Click &quot;Send All Emails&quot; to begin dispatch sequence.</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex items-start space-x-2">
                      <span className="text-slate-500 shrink-0">[{log.time}]</span>
                      <span
                        className={
                          log.type === 'success'
                            ? 'text-emerald-400'
                            : log.type === 'error'
                            ? 'text-rose-400 font-semibold'
                            : 'text-slate-300'
                        }
                      >
                        {log.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {validEmailRecipients.length} of {recipients.length} recipients ready for automated delivery.
          </span>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
