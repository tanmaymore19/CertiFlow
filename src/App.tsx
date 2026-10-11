import React, { useState, useEffect } from 'react';
import {
  auth,
  testConnection,
  onAuthStateChanged,
  User,
  signInWithPopup,
  googleProvider,
} from './lib/firebase';
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
import {
  Award,
  Sparkles,
  FileCheck,
  Zap,
  FolderArchive,
  ShieldCheck,
  CheckCircle2,
  LogIn,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [projects, setProjects] = useState<CertificateProject[]>([]);
  const [activeProject, setActiveProject] = useState<CertificateProject | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Connection test on boot as required by Firebase SKILL
  useEffect(() => {
    testConnection();
  }, []);

  // Auth observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        await loadProjects(user.uid);
      } else {
        setProjects([]);
        setActiveProject(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadProjects = async (userId: string) => {
    setIsDataLoading(true);
    try {
      const userProjects = await fetchUserProjects(userId);
      setProjects(userProjects);
    } catch (err) {
      console.error('Failed to load user projects:', err);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleCreateNewProject = () => {
    if (!currentUser) return;
    const newProject: CertificateProject = {
      id: `proj_${Date.now()}`,
      userId: currentUser.uid,
      userEmail: currentUser.email || 'admin@certiflow.app',
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
    if (!currentUser) return;
    const sample = SAMPLE_TEMPLATES[0];
    const dataUrl = createSampleTemplateDataUrl(sample.theme);
    const fields = getDefaultFieldsForTemplate();
    const { validatedRecords } = validateRecipients(SAMPLE_RECIPIENTS_DATA, fields);

    const demoProject: CertificateProject = {
      id: `proj_demo_${Date.now()}`,
      userId: currentUser.uid,
      userEmail: currentUser.email || 'admin@certiflow.app',
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

    // Save demo project to Cloud Firestore and open
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

  // Google sign in helper
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google Sign in failed:', err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500 text-white flex items-center justify-center animate-pulse shadow-md">
            <Award className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Loading CertiFlow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Navbar
        user={currentUser}
        onHomeClick={() => setActiveProject(null)}
        activeProjectName={activeProject?.name}
        onNewProjectClick={currentUser ? handleCreateNewProject : undefined}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!currentUser ? (
          /* Unauthenticated Landing & Login Prompt */
          <div className="max-w-4xl mx-auto py-12 space-y-12">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Administrator Access Portal</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tight">
                CertiFlow – Smart Certificate Generator
              </h1>
              <p className="text-slate-600 text-base max-w-2xl mx-auto leading-relaxed">
                Empower your organization to upload original certificate templates, visually place dynamic personal details, parse bulk Excel/CSV rosters, and generate hundreds of personalized vector PDF credentials.
              </p>
              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-lg shadow-slate-900/10 transition transform active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign in with Google as Administrator</span>
                </button>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900">Original Design Preservation</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Preserves original borders, backgrounds, crests, logos, and authorized signatures without unintended re-formatting.
                </p>
              </div>

              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900">Visual Layout & Auto-Shrink</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Click and drag dynamic text boxes. Configure fonts, sizes, alignments, and smart scaling to prevent text overflow.
                </p>
              </div>

              <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <FolderArchive className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900">Bulk ZIP & CSV Export</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Import spreadsheets with automated validation, track progress in real-time, and download all certificates in a clean ZIP package.
                </p>
              </div>
            </div>
          </div>
        ) : activeProject ? (
          /* Active Project Studio */
          <ProjectStudio
            project={activeProject}
            onSaveProject={handleSaveProject}
            onExit={() => {
              setActiveProject(null);
              if (currentUser) loadProjects(currentUser.uid);
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
        <p>CertiFlow – Smart Bulk Certificate Generator • Secured with Firebase & Cloud Firestore</p>
      </footer>
    </div>
  );
}
