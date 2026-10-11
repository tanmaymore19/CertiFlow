import React, { useState } from 'react';
import {
  Plus,
  Layers,
  Sparkles,
  Search,
  Calendar,
  Users,
  Award,
  Trash2,
  ExternalLink,
  FileCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { CertificateProject, ProjectStatus } from '../types/certificate';
import { StatsCards } from './StatsCards';

interface DashboardProps {
  projects: CertificateProject[];
  onNewProject: () => void;
  onOpenProject: (project: CertificateProject) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
  onQuickStartSample: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  onNewProject,
  onOpenProject,
  onDeleteProject,
  onQuickStartSample,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this certificate project and its metadata?')) {
      return;
    }
    setIsDeleting(projectId);
    try {
      await onDeleteProject(projectId);
    } finally {
      setIsDeleting(null);
    }
  };

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800">
            <FileCheck className="w-3 h-3" />
            <span>Ready to Generate</span>
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3" />
            <span>Processing</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
            <AlertCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            <span>Draft</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-8 sm:p-10 shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
          <Award className="w-96 h-96 transform rotate-12 text-white" />
        </div>

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart Automated Bulk Certification System</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Design once. Generate hundreds in seconds.
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed">
            Upload any original certificate template (PDF or Image), visually map dynamic text fields, import recipient spreadsheets, and export individualized high-resolution vector PDFs or a single ZIP archive.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onNewProject}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Project</span>
            </button>

            <button
              type="button"
              onClick={onQuickStartSample}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/10 transition"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Quick Start Demo Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Stats Cards */}
      <StatsCards projects={projects} />

      {/* Projects Management Section */}
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Certificate Projects</h3>
            <p className="text-xs text-slate-500">Manage and monitor your certificate batches</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-xl text-xs font-medium">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'all' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({projects.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ready')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'ready' ? 'bg-white shadow-xs text-indigo-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ready
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'completed' ? 'bg-white shadow-xs text-emerald-700 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Completed
              </button>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-3">
            <Layers className="w-12 h-12 mx-auto text-slate-300" />
            <h4 className="text-base font-semibold text-slate-800">No certificate projects found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? 'Try adjusting your search criteria or clear the filters.'
                : 'Get started by creating your first certificate project or loading a sample batch.'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onNewProject}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Project</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => {
              const recCount = project.recipientCount || project.recipients?.length || 0;
              const genCount = project.generatedCount || 0;

              return (
                <div
                  key={project.id}
                  onClick={() => onOpenProject(project)}
                  className="group cursor-pointer bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 overflow-hidden flex flex-col justify-between"
                >
                  <div className="p-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition truncate max-w-[220px]">
                          {project.name}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {project.description || 'No description provided'}
                        </p>
                      </div>
                      {getStatusBadge(project.status)}
                    </div>

                    {/* Template Thumbnail or Badge */}
                    <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 flex items-center justify-center">
                      {project.template?.dataUrl ? (
                        <img
                          src={project.template.dataUrl}
                          alt={project.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-center text-slate-400 p-4">
                          <FileText className="w-8 h-8 mx-auto mb-1 opacity-50" />
                          <span className="text-[11px]">No template loaded</span>
                        </div>
                      )}

                      {project.template && (
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-white text-[10px] font-mono backdrop-blur-xs flex items-center space-x-1">
                          {project.template.type === 'pdf' ? (
                            <FileText className="w-2.5 h-2.5" />
                          ) : (
                            <ImageIcon className="w-2.5 h-2.5" />
                          )}
                          <span className="uppercase">{project.template.type}</span>
                        </div>
                      )}
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Recipients</span>
                        <span className="font-bold text-slate-800 flex items-center space-x-1 mt-0.5">
                          <Users className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{recCount}</span>
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 text-[10px] block uppercase font-semibold">Generated</span>
                        <span className="font-bold text-slate-800 flex items-center space-x-1 mt-0.5">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span>{genCount}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px] flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                    </span>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, project.id)}
                        disabled={isDeleting === project.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <span className="inline-flex items-center space-x-1 text-indigo-600 font-semibold pl-2 group-hover:translate-x-0.5 transition-transform">
                        <span>Open Studio</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
