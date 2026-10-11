import React from 'react';
import { Award, Sparkles, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  onHomeClick: () => void;
  activeProjectName?: string;
  onNewProjectClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onHomeClick,
  activeProjectName,
  onNewProjectClick,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={onHomeClick}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-600 to-yellow-400 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-xl text-slate-900 tracking-tight">CertiFlow</span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">Smart Bulk Certificate Engine</p>
          </div>
        </div>

        {/* Center: active project breadcrumb if present */}
        {activeProjectName && (
          <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-slate-100/80 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500">Active Project:</span>
            <span className="font-semibold text-slate-800 truncate max-w-xs">{activeProjectName}</span>
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center space-x-3">
          {onNewProjectClick && (
            <button
              onClick={onNewProjectClick}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          )}

          {/* Admin badge */}
          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Administrator Workspace</span>
          </div>
        </div>
      </div>
    </header>
  );
};
