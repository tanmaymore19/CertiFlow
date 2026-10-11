import React from 'react';
import { Award, LogIn, LogOut, Sparkles, ShieldCheck } from 'lucide-react';
import { User, signInWithPopup, signOut, auth, googleProvider } from '../lib/firebase';

interface NavbarProps {
  user: User | null;
  onHomeClick: () => void;
  activeProjectName?: string;
  onNewProjectClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onHomeClick,
  activeProjectName,
  onNewProjectClick,
}) => {
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google Sign-in failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

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

        {/* Right Auth & Actions */}
        <div className="flex items-center space-x-3">
          {user ? (
            <div className="flex items-center space-x-3">
              {onNewProjectClick && (
                <button
                  onClick={onNewProjectClick}
                  className="hidden sm:inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>New Project</span>
                </button>
              )}

              {/* User badge */}
              <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Admin'}
                    className="w-8 h-8 rounded-full border border-slate-300"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold">
                    {user.email ? user.email[0].toUpperCase() : 'A'}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <div className="flex items-center space-x-1">
                    <span className="text-xs font-semibold text-slate-800 truncate max-w-[140px]">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium block">Authorized Admin</span>
                </div>

                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Authenticating...' : 'Sign in as Admin'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
