import express from 'express';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Increase payload limit for PDF/PNG attachments
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Helper to create nodemailer transporter for Gmail or Custom SMTP
  function createSmtpTransporter(providerConfig?: any) {
    if (!providerConfig) return null;

    // 1. Gmail Preset with fail-safe timeouts
    if (providerConfig.providerType === 'gmail' || (providerConfig.gmailUser && providerConfig.gmailAppPassword)) {
      const cleanPass = (providerConfig.gmailAppPassword || '').replace(/\s+/g, '');
      return nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: providerConfig.gmailUser.trim(),
          pass: cleanPass,
        },
        connectionTimeout: 10000, // 10s connection timeout
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
          rejectUnauthorized: false,
        },
      });
    }

    // 2. Custom SMTP
    if (providerConfig.smtpHost && (providerConfig.smtpUser || providerConfig.user)) {
      const host = providerConfig.smtpHost || providerConfig.host;
      const port = Number(providerConfig.smtpPort || providerConfig.port) || 587;
      const user = providerConfig.smtpUser || providerConfig.user;
      const pass = providerConfig.smtpPass || providerConfig.pass;
      const secure = Boolean(providerConfig.smtpSecure ?? providerConfig.secure);

      return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        tls: {
          rejectUnauthorized: false,
        },
      });
    }

    // 3. Fallback: Check environment variables
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        connectionTimeout: 10000,
        socketTimeout: 15000,
      });
    }

    return null;
  }

  // API Route: Test Provider Connection (Resend API Key, Gmail, or Custom SMTP)
  app.post(['/api/email/test-provider', '/api/email/test-smtp'], async (req, res) => {
    try {
      const config = req.body || {};
      const providerType = config.providerType || (config.resendApiKey ? 'resend' : config.gmailUser ? 'gmail' : 'custom_smtp');

      // 1. Test Resend API Key via lightweight GET request
      if (providerType === 'resend') {
        const apiKey = (config.resendApiKey || process.env.RESEND_API_KEY || '').trim();
        if (!apiKey) {
          return res.status(400).json({
            success: false,
            message: 'Please enter your Resend API Key (starts with "re_").',
          });
        }

        try {
          const resendCheck = await fetch('https://api.resend.com/api-keys', {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          });

          if (resendCheck.status === 200) {
            return res.json({
              success: true,
              message: 'Resend API Key verified successfully! Connection established over secure HTTPS (Port 443).',
            });
          } else if (resendCheck.status === 401 || resendCheck.status === 403) {
            return res.status(401).json({
              success: false,
              message: 'Invalid Resend API Key. Please verify your key at https://resend.com/api-keys',
            });
          } else {
            const errData = await resendCheck.json().catch(() => ({}));
            return res.status(400).json({
              success: false,
              message: errData.message || `Resend API returned HTTP ${resendCheck.status}.`,
            });
          }
        } catch (fetchErr: any) {
          return res.status(500).json({
            success: false,
            message: `Failed to connect to Resend API: ${fetchErr?.message || 'Network error'}`,
          });
        }
      }

      // 2. Test Simulation Mode
      if (providerType === 'simulation') {
        return res.json({
          success: true,
          message: 'Simulation mode is ready! Emails will be simulated with realistic status logs.',
        });
      }

      // 3. Test Gmail / Custom SMTP
      const transporter = createSmtpTransporter(config);
      if (!transporter) {
        return res.status(400).json({
          success: false,
          message: providerType === 'gmail'
            ? 'Please provide both your Gmail address and 16-character App Password.'
            : 'Please provide valid SMTP credentials (host, port, username, password).',
        });
      }

      await transporter.verify();
      return res.json({
        success: true,
        message: providerType === 'gmail'
          ? 'Gmail App Password verified! SMTP connection established successfully.'
          : 'SMTP connection verified successfully! Server is ready to send emails.',
      });
    } catch (error: any) {
      console.error('Provider Verify Error:', error);
      const errMsg = String(error?.message || '');
      const errCode = String(error?.code || '');

      if (errMsg.includes('535') || errMsg.includes('Username and Password not accepted') || errMsg.includes('BadCredentials')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication Failed: Invalid Google App Password. Please generate a 16-character App Password at myaccount.google.com/apppasswords (do NOT use your regular Gmail password).',
        });
      }

      if (errCode === 'ETIMEDOUT' || errCode === 'ESOCKETTIMEDOUT' || errCode === 'ECONNREFUSED' || errMsg.includes('timeout')) {
        return res.status(504).json({
          success: false,
          message: 'Connection Timeout: Raw SMTP socket was blocked by cloud/host network firewall. We strongly recommend switching to the "Email API (Resend)" option above, which sends via standard HTTPS with zero port blocks.',
        });
      }

      return res.status(500).json({
        success: false,
        message: error?.message || 'Failed to authenticate email provider.',
      });
    }
  });

  // API Route: Send Single Certificate Email
  app.post('/api/email/send', async (req, res) => {
    try {
      const { to, recipientName, subject, body, attachments, providerConfig, smtpConfig } = req.body;

      if (!to) {
        return res.status(400).json({ success: false, error: 'Recipient email is required.' });
      }

      const activeConfig = providerConfig || smtpConfig || {};
      const providerType = activeConfig.providerType || (activeConfig.resendApiKey ? 'resend' : activeConfig.gmailUser ? 'gmail' : (activeConfig.host ? 'custom_smtp' : 'simulation'));

      // ==========================================
      // OPTION A: Modern Email API (Resend HTTPS)
      // ==========================================
      if (providerType === 'resend') {
        const apiKey = (activeConfig.resendApiKey || process.env.RESEND_API_KEY || '').trim();
        if (!apiKey) {
          return res.status(400).json({
            success: false,
            error: 'Missing Resend API Key. Please provide your API Key from resend.com/api-keys.',
          });
        }

        // Prepare Base64 attachments for Resend
        const resendAttachments = (attachments || []).map((att: any) => ({
          filename: att.filename,
          content: att.contentBase64,
        }));

        const senderName = activeConfig.fromName || 'CertiFlow Certificates';
        let fromAddress = (activeConfig.resendFrom || activeConfig.fromEmail || '').trim();
        if (!fromAddress) {
          fromAddress = `${senderName} <onboarding@resend.dev>`;
        } else if (!fromAddress.includes('<')) {
          fromAddress = `${senderName} <${fromAddress}>`;
        }

        const resendPayload: any = {
          from: fromAddress,
          to: [to.trim()],
          subject: subject || 'Your Certificate of Achievement',
          text: body || '',
          html: `<div style="font-family: Arial, -apple-system, BlinkMacSystemFont, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b; white-space: pre-line;">${body}</div>`,
        };

        if (resendAttachments.length > 0) {
          resendPayload.attachments = resendAttachments;
        }

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(resendPayload),
        });

        const resendData = await resendRes.json().catch(() => ({}));

        if (resendRes.ok) {
          console.log(`[Resend API Success] Dispatched to ${to}: ${resendData.id}`);
          return res.json({
            success: true,
            messageId: resendData.id,
            provider: 'resend',
            rawResponse: resendData,
          });
        } else {
          console.error(`[Resend API Error HTTP ${resendRes.status}] to ${to}:`, resendData);
          const rawMessage = String(resendData.message || resendData.error || '');
          const isTestingModeBlock =
            resendRes.status === 403 ||
            /only send testing emails|own email address|testing email|verify.*domain|domain.*not.*verified|sandbox/i.test(
              rawMessage
            );

          let errorExplanation = rawMessage || `Resend API returned HTTP ${resendRes.status}`;

          if (isTestingModeBlock) {
            errorExplanation =
              `Testing Mode Restriction Detected: Your email provider (Resend) only allows sending to your registered account email. To send bulk emails to external recipients, you must add and verify your custom domain in Resend, OR switch to Option B (Direct Gmail Relay / SMTP) which has zero domain restrictions.`;
          } else if (resendRes.status === 401) {
            errorExplanation = 'Invalid Resend API Key. Please verify your key at resend.com/api-keys';
          } else if (resendRes.status === 429) {
            errorExplanation = 'Resend rate limit exceeded (too many requests per second). Interval delay has been applied.';
          }

          return res.status(resendRes.status).json({
            success: false,
            error: errorExplanation,
            statusCode: resendRes.status,
            isTestingModeRestriction: isTestingModeBlock,
            rawProviderMessage: rawMessage,
            rawProviderError: resendData,
            recipient: to,
            provider: 'resend',
          });
        }
      }

      // ==========================================
      // OPTION B: Gmail or Custom SMTP (Nodemailer)
      // ==========================================
      if (providerType === 'gmail' || providerType === 'custom_smtp') {
        const transporter = createSmtpTransporter(activeConfig);
        if (!transporter) {
          return res.status(400).json({
            success: false,
            error: providerType === 'gmail'
              ? 'Missing Gmail address or App Password.'
              : 'Missing SMTP credentials.',
          });
        }

        const mailAttachments = (attachments || []).map((att: any) => ({
          filename: att.filename,
          content: Buffer.from(att.contentBase64, 'base64'),
          contentType: att.contentType,
        }));

        const fromAddress = activeConfig.from ||
          (activeConfig.gmailUser ? `${activeConfig.fromName || 'CertiFlow'} <${activeConfig.gmailUser}>` : undefined) ||
          process.env.SMTP_FROM ||
          'CertiFlow <certificates@certiflow.app>';

        const info = await transporter.sendMail({
          from: fromAddress,
          to,
          subject,
          text: body,
          html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; white-space: pre-line;">${body}</div>`,
          attachments: mailAttachments,
        });

        console.log(`[SMTP Success] Sent to ${to}: ${info.messageId}`);
        return res.json({
          success: true,
          messageId: info.messageId,
          provider: providerType,
        });
      }

      // ==========================================
      // OPTION C: Instant Simulation Mode (Demo)
      // ==========================================
      console.log(`[Email Simulation] Dispatching to: ${to} (${recipientName}) | Subject: ${subject}`);
      return res.json({
        success: true,
        messageId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        simulated: true,
        message: `Dispatched in simulation mode to ${to}`,
      });
    } catch (error: any) {
      console.error('Error sending email:', error);
      const errMsg = String(error?.message || '');
      const errCode = String(error?.code || '');

      let userFriendlyError = errMsg;
      if (errMsg.includes('535') || errMsg.includes('Username and Password not accepted')) {
        userFriendlyError = 'Gmail Authentication Failed: Please use a 16-character Google App Password (not your normal Gmail password).';
      } else if (errCode === 'ETIMEDOUT' || errCode === 'ESOCKETTIMEDOUT' || errCode === 'ECONNREFUSED' || errMsg.includes('timeout')) {
        userFriendlyError = 'SMTP Connection Timeout: Port blocked by cloud firewall. Please switch to the "Email API (Resend)" option.';
      }

      return res.status(500).json({
        success: false,
        error: userFriendlyError,
      });
    }
  });

  // Mount Vite development middlewares in dev mode
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static build in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`CertiFlow Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
