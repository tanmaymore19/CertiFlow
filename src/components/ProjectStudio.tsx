import React, { useState } from 'react';
import {
  FileImage,
  Sliders,
  Users,
  Eye,
  Sparkles,
  Save,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  CertificateProject,
  CertificateTemplate,
  FieldConfig,
  RecipientRecord,
} from '../types/certificate';
import { TemplateUploader } from './TemplateUploader';
import { VisualEditor } from './VisualEditor';
import { RecipientManager } from './RecipientManager';
import { PreviewStep } from './PreviewStep';
import { BulkGenerator } from './BulkGenerator';
import { getDefaultFieldsForTemplate } from '../lib/sampleTemplates';

interface ProjectStudioProps {
  project: CertificateProject;
  onSaveProject: (updated: CertificateProject) => Promise<void>;
  onExit: () => void;
}

export const ProjectStudio: React.FC<ProjectStudioProps> = ({
  project: initialProject,
  onSaveProject,
  onExit,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [projectName, setProjectName] = useState(initialProject.name || 'Untitled Certificate Project');
  const [projectDescription, setProjectDescription] = useState(initialProject.description || '');
  const [template, setTemplate] = useState<CertificateTemplate | null>(initialProject.template || null);
  const [fields, setFields] = useState<FieldConfig[]>(
    initialProject.fields && initialProject.fields.length > 0
      ? initialProject.fields
      : getDefaultFieldsForTemplate()
  );
  const [recipients, setRecipients] = useState<RecipientRecord[]>(initialProject.recipients || []);
  const [availableColumns, setAvailableColumns] = useState<string[]>(() => {
    if (initialProject.recipients && initialProject.recipients.length > 0) {
      return Object.keys(initialProject.recipients[0].data);
    }
    return ['Full Name', 'Email', 'Certificate ID', 'Course Name', 'Organization Name', 'Issue Date', 'Designation'];
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const steps = [
    { num: 1, label: 'Template Setup', icon: FileImage, desc: 'Upload or choose design' },
    { num: 2, label: 'Dynamic Fields', icon: Sliders, desc: 'Position text & typography' },
    { num: 3, label: 'Recipient Data', icon: Users, desc: 'Import Excel/CSV & map' },
    { num: 4, label: 'Preview & QA', icon: Eye, desc: 'Inspect individual records' },
    { num: 5, label: 'Generate & Export', icon: Sparkles, desc: 'Bulk PDFs & ZIP archive' },
  ];

  const handleTemplateSelected = (newTemplate: CertificateTemplate) => {
    setTemplate(newTemplate);
    // If fields are empty, initialize default fields
    if (fields.length === 0) {
      setFields(getDefaultFieldsForTemplate());
    }
  };

  const handleSave = async (silent = false) => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const updatedProject: CertificateProject = {
        ...initialProject,
        name: projectName,
        description: projectDescription,
        template,
        fields,
        recipients,
        recipientCount: recipients.length,
        status:
          recipients.length > 0 && template
            ? initialProject.status === 'completed'
              ? 'completed'
              : 'ready'
            : 'draft',
        updatedAt: new Date().toISOString(),
      };
      await onSaveProject(updatedProject);
      if (!silent) {
        setSaveMessage('Project saved successfully to Cloud Firestore.');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save project:', err);
      setSaveMessage('Failed to save to database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerationComplete = async (generatedCount: number, failedCount: number) => {
    const updatedProject: CertificateProject = {
      ...initialProject,
      name: projectName,
      description: projectDescription,
      template,
      fields,
      recipients,
      recipientCount: recipients.length,
      generatedCount,
      failedCount,
      status: failedCount === 0 ? 'completed' : 'failed',
      updatedAt: new Date().toISOString(),
    };
    await onSaveProject(updatedProject);
  };

  return (
    <div className="space-y-6">
      {/* Top Project Meta & Step Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onExit}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="font-bold text-lg text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-hidden bg-transparent px-1 py-0.5 rounded transition"
                  placeholder="Certificate Project Name"
                />
              </div>
              <input
                type="text"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="text-xs text-slate-500 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-hidden bg-transparent px-1 py-0.5 rounded w-full max-w-md transition"
                placeholder="Optional description / event notes..."
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {saveMessage && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {saveMessage}
              </span>
            )}
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Project'}</span>
            </button>
          </div>
        </div>

        {/* 5-Step Process Bar */}
        <div className="grid grid-cols-5 gap-2 pt-2 border-t border-slate-100">
          {steps.map((st) => {
            const Icon = st.icon;
            const isActive = currentStep === st.num;
            const isCompleted = currentStep > st.num;

            return (
              <button
                key={st.num}
                type="button"
                onClick={() => setCurrentStep(st.num)}
                className={`text-left p-2.5 rounded-xl transition border ${
                  isActive
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/10'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/20 text-emerald-900 hover:bg-slate-50'
                    : 'border-slate-100 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : st.num}
                  </div>
                  <span className="font-semibold text-xs truncate hidden sm:inline">
                    {st.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Content Panels */}
      <div>
        {currentStep === 1 && (
          <div className="space-y-6">
            <TemplateUploader
              currentTemplate={template}
              onTemplateSelected={handleTemplateSelected}
            />
            <div className="flex justify-end pt-4">
              <button
                type="button"
                disabled={!template}
                onClick={() => {
                  handleSave(true);
                  setCurrentStep(2);
                }}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition"
              >
                <span>Continue to Dynamic Fields</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            {template ? (
              <VisualEditor
                template={template}
                fields={fields}
                availableColumns={availableColumns}
                onChangeFields={setFields}
                recipients={recipients}
                sampleRecipientData={recipients[0]?.data}
                onUpdateRecipientData={(updatedData) => {
                  if (recipients.length > 0) {
                    const updatedRecs = [...recipients];
                    updatedRecs[0] = { ...updatedRecs[0], data: updatedData };
                    setRecipients(updatedRecs);
                  }
                }}
              />
            ) : (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                <p className="text-slate-600 font-medium">Please upload a certificate template first.</p>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                >
                  Go to Step 1
                </button>
              </div>
            )}
            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSave(true);
                  setCurrentStep(3);
                }}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition"
              >
                <span>Continue to Recipient Data</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <RecipientManager
              fields={fields}
              recipients={recipients}
              availableColumns={availableColumns}
              onChangeRecipients={setRecipients}
              onChangeColumns={setAvailableColumns}
              onUpdateFields={setFields}
            />
            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={recipients.length === 0}
                onClick={() => {
                  handleSave(true);
                  setCurrentStep(4);
                }}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition"
              >
                <span>Continue to Preview & QA</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            {template && recipients.length > 0 ? (
              <PreviewStep
                template={template}
                fields={fields}
                recipients={recipients}
                projectName={projectName}
                onBackToEditor={() => setCurrentStep(2)}
                onProceedToGenerate={() => setCurrentStep(5)}
                onUpdateRecipient={(updatedRec) => {
                  setRecipients((prev) =>
                    prev.map((r) => (r.id === updatedRec.id ? updatedRec : r))
                  );
                }}
              />
            ) : (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                <p className="text-slate-600 font-medium">
                  Ensure both a template and recipient records are loaded.
                </p>
              </div>
            )}
            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSave(true);
                  setCurrentStep(5);
                }}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition"
              >
                <span>Proceed to Bulk Generation</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6">
            {template && recipients.length > 0 ? (
              <BulkGenerator
                template={template}
                fields={fields}
                recipients={recipients}
                projectName={projectName}
                projectId={initialProject.id}
                onGenerationComplete={handleGenerationComplete}
                onUpdateRecipients={setRecipients}
              />
            ) : (
              <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                <p className="text-slate-600 font-medium">
                  Missing template or recipient records to generate certificates.
                </p>
              </div>
            )}
            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Preview</span>
              </button>
              <button
                type="button"
                onClick={onExit}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition"
              >
                <span>Return to Projects Dashboard</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
