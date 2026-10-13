import { CertificateTemplate, FieldConfig } from '../types/certificate';

// Create SVG-based template data URIs rendered at high resolution
export function createSampleTemplateDataUrl(theme: 'modern_gold' | 'emerald_diploma' | 'tech_completion'): string {
  if (theme === 'modern_gold') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850" width="1200" height="850">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="50%" stop-color="#fafafa"/>
          <stop offset="100%" stop-color="#f5f3ef"/>
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#d4af37"/>
          <stop offset="50%" stop-color="#f3e5ab"/>
          <stop offset="100%" stop-color="#aa771c"/>
        </linearGradient>
        <linearGradient id="navyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="1200" height="850" fill="url(#bgGrad)"/>
      
      <!-- Outer Border -->
      <rect x="30" y="30" width="1140" height="790" fill="none" stroke="url(#goldGrad)" stroke-width="6" rx="8"/>
      <!-- Inner Thin Border -->
      <rect x="42" y="42" width="1116" height="766" fill="none" stroke="#0f172a" stroke-width="1.5" stroke-dasharray="8 4" rx="6"/>
      
      <!-- Corner Accents -->
      <path d="M 30 100 L 100 30" stroke="url(#goldGrad)" stroke-width="4" fill="none"/>
      <path d="M 1100 30 L 1170 100" stroke="url(#goldGrad)" stroke-width="4" fill="none"/>
      <path d="M 30 750 L 100 820" stroke="url(#goldGrad)" stroke-width="4" fill="none"/>
      <path d="M 1100 820 L 1170 750" stroke="url(#goldGrad)" stroke-width="4" fill="none"/>

      <!-- Header Ribbon / Ornament -->
      <g transform="translate(600, 110)" text-anchor="middle">
        <path d="M -90 -15 L 0 -35 L 90 -15 L 70 5 L 0 -10 L -70 5 Z" fill="url(#goldGrad)" opacity="0.9"/>
        <text y="20" font-family="'Cinzel', 'Times New Roman', serif" font-size="16" letter-spacing="8" fill="#d4af37" font-weight="bold">ACADEMY OF PROFESSIONAL EXCELLENCE</text>
        <text y="70" font-family="'Cinzel', 'Times New Roman', serif" font-size="46" letter-spacing="4" fill="#0f172a" font-weight="bold">CERTIFICATE OF ACHIEVEMENT</text>
        <text y="105" font-family="'Cinzel', 'Times New Roman', serif" font-size="14" letter-spacing="3" fill="#64748b" font-style="italic">THIS IS PROUDLY PRESENTED TO</text>
      </g>
      
      <!-- Placeholder underline for Recipient Name -->
      <line x1="260" y1="360" x2="940" y2="360" stroke="#cbd5e1" stroke-width="1.5"/>

      <!-- Certificate Body Text Placeholder -->
      <g transform="translate(600, 420)" text-anchor="middle">
        <text font-family="'Helvetica', sans-serif" font-size="15" fill="#475569" letter-spacing="1">for successfully completing all curriculum standards, assignments, and practical evaluations in</text>
      </g>

      <!-- Placeholder underline for Course -->
      <line x1="320" y1="510" x2="880" y2="510" stroke="#cbd5e1" stroke-width="1"/>

      <!-- Seal & Signatures -->
      <!-- Left Signature -->
      <g transform="translate(260, 680)">
        <path d="M 0 -15 Q 40 -35 80 -10 T 160 -15" stroke="#1e293b" stroke-width="2" fill="none"/>
        <line x1="0" y1="0" x2="180" y2="0" stroke="#94a3b8" stroke-width="1.5"/>
        <text x="90" y="22" font-family="'Helvetica', sans-serif" font-size="12" fill="#475569" text-anchor="middle" font-weight="bold">DIRECTOR OF CERTIFICATION</text>
        <text x="90" y="38" font-family="'Helvetica', sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">Academic Council</text>
      </g>

      <!-- Center Seal -->
      <g transform="translate(600, 670)">
        <circle r="46" fill="#f8fafc" stroke="url(#goldGrad)" stroke-width="4"/>
        <circle r="38" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-dasharray="4 2"/>
        <!-- Star icon in seal -->
        <polygon points="0,-22 6,-8 22,-8 10,2 14,18 0,8 -14,18 -10,2 -22,-8 -6,-8" fill="url(#goldGrad)"/>
        <text y="28" font-family="'Times New Roman', serif" font-size="8" fill="#aa771c" text-anchor="middle" letter-spacing="2" font-weight="bold">VERIFIED AUTHENTIC</text>
      </g>

      <!-- Right Signature -->
      <g transform="translate(760, 680)">
        <path d="M 10 -20 Q 50 -40 100 -20 T 170 -15" stroke="#1e293b" stroke-width="2" fill="none"/>
        <line x1="0" y1="0" x2="180" y2="0" stroke="#94a3b8" stroke-width="1.5"/>
        <text x="90" y="22" font-family="'Helvetica', sans-serif" font-size="12" fill="#475569" text-anchor="middle" font-weight="bold">EXECUTIVE REGISTRAR</text>
        <text x="90" y="38" font-family="'Helvetica', sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">Board of Trustees</text>
      </g>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  if (theme === 'emerald_diploma') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850" width="1200" height="850">
      <defs>
        <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#064e3b"/>
          <stop offset="100%" stop-color="#047857"/>
        </linearGradient>
        <linearGradient id="gold2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#d97706"/>
          <stop offset="100%" stop-color="#f59e0b"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="850" fill="#fcfbf7"/>
      <!-- Borders -->
      <rect x="35" y="35" width="1130" height="780" fill="none" stroke="#064e3b" stroke-width="8"/>
      <rect x="47" y="47" width="1106" height="756" fill="none" stroke="#d97706" stroke-width="2"/>
      
      <!-- Top banner -->
      <g transform="translate(600, 120)" text-anchor="middle">
        <text font-family="'Times New Roman', serif" font-size="18" letter-spacing="6" fill="#047857" font-weight="bold">INSTITUTE OF PROFESSIONAL DEVELOPMENT</text>
        <text y="60" font-family="'Times New Roman', serif" font-size="44" letter-spacing="3" fill="#064e3b" font-weight="bold">DIPLOMA OF COMPLETION</text>
        <text y="95" font-family="'Times New Roman', serif" font-size="15" letter-spacing="2" fill="#4b5563" font-style="italic">THIS DIPLOMA IS CONFERRED UPON</text>
      </g>

      <line x1="280" y1="360" x2="920" y2="360" stroke="#047857" stroke-width="1.5"/>

      <g transform="translate(600, 420)" text-anchor="middle">
        <text font-family="'Helvetica', sans-serif" font-size="15" fill="#374151">having demonstrated proficiency and mastery of the required practical modules in</text>
      </g>
      <line x1="340" y1="510" x2="860" y2="510" stroke="#cbd5e1" stroke-width="1"/>

      <!-- Signatures -->
      <g transform="translate(280, 690)">
        <path d="M 10 -20 Q 60 -40 110 -15 T 160 -20" stroke="#064e3b" stroke-width="2" fill="none"/>
        <line x1="0" y1="0" x2="180" y2="0" stroke="#4b5563" stroke-width="1.5"/>
        <text x="90" y="24" font-family="'Helvetica', sans-serif" font-size="12" fill="#1f2937" text-anchor="middle" font-weight="bold">PROGRAM CHAIR</text>
      </g>
      <g transform="translate(740, 690)">
        <path d="M 10 -15 Q 50 -35 120 -20 T 170 -15" stroke="#064e3b" stroke-width="2" fill="none"/>
        <line x1="0" y1="0" x2="180" y2="0" stroke="#4b5563" stroke-width="1.5"/>
        <text x="90" y="24" font-family="'Helvetica', sans-serif" font-size="12" fill="#1f2937" text-anchor="middle" font-weight="bold">PRESIDENT</text>
      </g>
      <g transform="translate(600, 680)">
        <circle r="44" fill="#f0fdf4" stroke="#064e3b" stroke-width="3"/>
        <circle r="36" fill="none" stroke="#d97706" stroke-width="1.5"/>
        <text y="5" font-family="'Times New Roman', serif" font-size="11" fill="#064e3b" text-anchor="middle" font-weight="bold">OFFICIAL SEAL</text>
      </g>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  // tech_completion
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850" width="1200" height="850">
    <defs>
      <linearGradient id="techBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e1b4b"/>
      </linearGradient>
      <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#06b6d4"/>
        <stop offset="100%" stop-color="#3b82f6"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="850" fill="url(#techBg)"/>
    <rect x="30" y="30" width="1140" height="790" fill="none" stroke="#334155" stroke-width="2" rx="12"/>
    <rect x="42" y="42" width="1116" height="766" fill="none" stroke="url(#cyanGrad)" stroke-width="1.5" rx="8" opacity="0.6"/>
    
    <g transform="translate(600, 130)" text-anchor="middle">
      <text font-family="'Helvetica', sans-serif" font-size="14" letter-spacing="8" fill="#38bdf8" font-weight="bold">TECH ACCELERATOR LABS</text>
      <text y="60" font-family="'Helvetica', sans-serif" font-size="44" letter-spacing="4" fill="#ffffff" font-weight="bold">CERTIFICATE OF RECOGNITION</text>
      <text y="95" font-family="'Helvetica', sans-serif" font-size="14" letter-spacing="3" fill="#94a3b8">PRESENTED IN APPRECIATION TO</text>
    </g>

    <line x1="260" y1="360" x2="940" y2="360" stroke="#38bdf8" stroke-width="2"/>
    
    <g transform="translate(600, 420)" text-anchor="middle">
      <text font-family="'Helvetica', sans-serif" font-size="15" fill="#cbd5e1">for successful participation, engineering capstone delivery, and active contribution to</text>
    </g>
    <line x1="320" y1="510" x2="880" y2="510" stroke="#334155" stroke-width="1.5"/>

    <g transform="translate(280, 690)">
      <line x1="0" y1="0" x2="180" y2="0" stroke="#64748b" stroke-width="1.5"/>
      <text x="90" y="24" font-family="'Helvetica', sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle" font-weight="bold">LEAD INSTRUCTOR</text>
    </g>
    <g transform="translate(740, 690)">
      <line x1="0" y1="0" x2="180" y2="0" stroke="#64748b" stroke-width="1.5"/>
      <text x="90" y="24" font-family="'Helvetica', sans-serif" font-size="12" fill="#94a3b8" text-anchor="middle" font-weight="bold">DIRECTOR OF INNOVATION</text>
    </g>
    <g transform="translate(600, 680)">
      <circle r="40" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
      <text y="5" font-family="'Helvetica', sans-serif" font-size="10" fill="#38bdf8" text-anchor="middle" font-weight="bold">SECURE CERT</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getDefaultFieldsForTemplate(): FieldConfig[] {
  return [
    {
      id: 'field_name',
      label: 'Recipient Full Name',
      type: 'full_name',
      mappedColumn: 'Full Name',
      sampleValue: 'Rahul Patil',
      xPercent: 20,
      yPercent: 36, // positioned right above line y=360
      widthPercent: 60,
      fontFamily: 'TimesRoman',
      fontSize: 34,
      fontColor: '#0f172a',
      textAlign: 'center',
      isBold: true,
      isItalic: false,
      textTransform: 'none',
      autoScale: true,
    },
    {
      id: 'field_course',
      label: 'Course / Event Name',
      type: 'course_name',
      mappedColumn: 'Course Name',
      sampleValue: 'Full Stack Web Development & Cloud Systems',
      xPercent: 25,
      yPercent: 54, // positioned right above line y=510
      widthPercent: 50,
      fontFamily: 'Helvetica',
      fontSize: 20,
      fontColor: '#1e293b',
      textAlign: 'center',
      isBold: true,
      isItalic: false,
      textTransform: 'none',
      autoScale: true,
    },
    {
      id: 'field_cert_id',
      label: 'Certificate ID',
      type: 'cert_id',
      mappedColumn: 'Certificate ID',
      sampleValue: 'CERT-2026-0891',
      xPercent: 70,
      yPercent: 91,
      widthPercent: 25,
      fontFamily: 'Courier',
      fontSize: 11,
      fontColor: '#64748b',
      textAlign: 'right',
      isBold: false,
      isItalic: false,
      textTransform: 'uppercase',
      autoScale: true,
    },
    {
      id: 'field_date',
      label: 'Issue Date',
      type: 'issue_date',
      mappedColumn: 'Issue Date',
      sampleValue: '10 Oct 2026',
      xPercent: 5,
      yPercent: 91,
      widthPercent: 25,
      fontFamily: 'Helvetica',
      fontSize: 11,
      fontColor: '#64748b',
      textAlign: 'left',
      isBold: false,
      isItalic: false,
      textTransform: 'none',
      autoScale: false,
    },
  ];
}

export const SAMPLE_TEMPLATES: {
  id: string;
  name: string;
  theme: 'modern_gold' | 'emerald_diploma' | 'tech_completion';
  category: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  width: number;
  height: number;
}[] = [
  {
    id: 'gold_achievement',
    name: 'Modern Gold Achievement Award',
    theme: 'modern_gold',
    category: 'Corporate & Academic',
    description: 'Regal gold border with classical crest and dual signature authority lines.',
    orientation: 'landscape',
    width: 1200,
    height: 850,
  },
  {
    id: 'emerald_diploma',
    name: 'Emerald Executive Diploma',
    theme: 'emerald_diploma',
    category: 'Workshops & Training',
    description: 'Rich forest emerald geometric styling with official institute seal.',
    orientation: 'landscape',
    width: 1200,
    height: 850,
  },
  {
    id: 'tech_completion',
    name: 'Cyber Tech Completion Award',
    theme: 'tech_completion',
    category: 'Technology & Bootcamps',
    description: 'High-contrast dark mode design with neon cyan accents for software programs.',
    orientation: 'landscape',
    width: 1200,
    height: 850,
  },
];

export const SAMPLE_RECIPIENTS_DATA = [
  {
    'Full Name': 'Rahul Patil',
    'Email': 'rahul.patil@example.com',
    'Certificate ID': 'CERT-001',
    'Course Name': 'Full Stack Web Development & Cloud Systems',
    'Organization Name': 'Apex Tech Institute',
    'Issue Date': '10 Oct 2026',
    'Designation': 'Lead Engineer',
  },
  {
    'Full Name': 'Priya Sharma',
    'Email': 'priya.sharma@example.com',
    'Certificate ID': 'CERT-002',
    'Course Name': 'Full Stack Web Development & Cloud Systems',
    'Organization Name': 'Apex Tech Institute',
    'Issue Date': '10 Oct 2026',
    'Designation': 'Full Stack Developer',
  },
  {
    'Full Name': 'Amit Deshmukh',
    'Email': 'amit.deshmukh@example.com',
    'Certificate ID': 'CERT-003',
    'Course Name': 'Full Stack Web Development & Cloud Systems',
    'Organization Name': 'Apex Tech Institute',
    'Issue Date': '10 Oct 2026',
    'Designation': 'Software Architect',
  },
  {
    'Full Name': 'Sarah Jenkins',
    'Email': 'sarah.jenkins@example.com',
    'Certificate ID': 'CERT-004',
    'Course Name': 'Full Stack Web Development & Cloud Systems',
    'Organization Name': 'Apex Tech Institute',
    'Issue Date': '10 Oct 2026',
    'Designation': 'Cloud Consultant',
  },
  {
    'Full Name': 'David Chen',
    'Email': 'david.chen@example.com',
    'Certificate ID': 'CERT-005',
    'Course Name': 'Full Stack Web Development & Cloud Systems',
    'Organization Name': 'Apex Tech Institute',
    'Issue Date': '10 Oct 2026',
    'Designation': 'Data Engineer',
  },
];
