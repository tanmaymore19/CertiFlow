import React, { useState, useEffect } from 'react';
import { testConnection } from './lib/firebase';
import { CertificateProject } from './types/certificate';
import { fetchUserProjects, saveProject, deleteProject } from './lib/projectService';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { ProjectStudio } from './components/ProjectStudio';
import {
  SAMPLE_TEMPLATES,
  createSampleTemplateDataUrl,
  getDefaultFieldsForTemplate,
  SAMPLE_RECIPIENTS_DATA,
} from './lib/sampleTemplates';
import { validateRecipients } from './lib/spreadsheet';
import { Award } from 'lucide-react';

const DEFAULT_USER_ID = 'admin_default_user';

export default function App() {
  const [projects, setProjects] = useState<CertificateProject[]>([]);
  const [activeProject, setActiveProject] = useState<CertificateProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Connection test & load projects on boot
  useEffect(() => {
    testConnection();
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const userProjects = await fetchUserProjects();
      setProjects(userProjects);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewProject = () => {
    const newProject: CertificateProject = {
      id: `proj_${Date.now()}`,
      userId: DEFAULT_USER_ID,
      userEmail: 'admin@certiflow.app',
      name: 'New Certificate Project',
      description: 'Annual certification cohort',
      status: 'draft',
      template: null,
      fields: getDefaultFieldsForTemplate(),
      recipients: [],
      recipientCount: 0,
      generatedCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setActiveProject(newProject);
  };

  const handleQuickStartDemo = async () => {
    const sample = SAMPLE_TEMPLATES[0];
    const dataUrl = createSampleTemplateDataUrl(sample.theme);
    const fields = getDefaultFieldsForTemplate();
    const { validatedRecords } = validateRecipients(SAMPLE_RECIPIENTS_DATA, fields);

    const demoProject: CertificateProject = {
      id: `proj_demo_${Date.now()}`,
      userId: DEFAULT_USER_ID,
      userEmail: 'admin@certiflow.app',
      name: 'Web Dev & Cloud Certification 2026',
      description: 'Official Academy of Professional Excellence Credentials',
      status: 'ready',
      template: {
        name: `${sample.name}.svg`,
        type: 'image',
        mimeType: 'image/svg+xml',
        dataUrl,
        pageNumber: 1,
        pageCount: 1,
        width: sample.width,
        height: sample.height,
        orientation: sample.orientation,
      },
      fields,
      recipients: validatedRecords,
      recipientCount: validatedRecords.length,
      generatedCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await handleSaveProject(demoProject);
    setActiveProject(demoProject);
  };

  const handleSaveProject = async (projectToSave: CertificateProject) => {
    try {
      await saveProject(projectToSave);
      setProjects((prev) => {
        const idx = prev.findIndex((p) => p.id === projectToSave.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = projectToSave;
          return next;
        }
        return [projectToSave, ...prev];
      });
      setActiveProject(projectToSave);
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (activeProject?.id === projectId) {
        setActiveProject(null);
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500 text-white flex items-center justify-center animate-pulse shadow-md">
            <Award className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Loading CertiFlow Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Navbar
        onHomeClick={() => setActiveProject(null)}
        activeProjectName={activeProject?.name}
        onNewProjectClick={handleCreateNewProject}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeProject ? (
          /* Active Project Studio */
          <ProjectStudio
            project={activeProject}
            onSaveProject={handleSaveProject}
            onExit={() => {
              setActiveProject(null);
              loadProjects();
            }}
          />
        ) : (
          /* Main Dashboard */
          <Dashboard
            projects={projects}
            onNewProject={handleCreateNewProject}
            onOpenProject={(proj) => setActiveProject(proj)}
            onDeleteProject={handleDeleteProject}
            onQuickStartSample={handleQuickStartDemo}
          />
        )}
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white/50 py-6 text-center text-xs text-slate-500">
        <p>CertiFlow – Smart Bulk Certificate Generator • Cloud Firestore Enabled</p>
      </footer>
    </div>
  );
}
