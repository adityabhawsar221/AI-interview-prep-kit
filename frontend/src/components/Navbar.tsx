import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Plus, ChevronDown, Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { KitRecord } from '../types';

interface NavbarProps {
  onOpenGenerate?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenGenerate }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [kits, setKits] = useState<KitRecord[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (user) {
      api.getUserKits()
        .then((res) => setKits(res || []))
        .catch(() => {});
    }
  }, [user]);

  // Hide Navbar completely on Login and Register pages as requested
  if (location.pathname === '/login' || location.pathname === '/register') {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FCFAF6]/90 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand with corrected spelling */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="font-bold text-xl sm:text-2xl tracking-tight text-neutral-900 group-hover:text-neutral-700 transition-colors">
            AI Interview Preparation Kit
          </span>
        </Link>

        {/* Right Nav / Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* My Kits Dropdown */}
              {kits.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-full hover:bg-neutral-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-orange-500" />
                    <span>My Kits ({kits.length})</span>
                    <ChevronDown className="w-3 h-3 text-neutral-400" />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-neutral-200 rounded-2xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                        Saved Interview Kits
                      </div>
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {kits.map((k) => (
                          <button
                            key={k._id}
                            onClick={() => {
                              setDropdownOpen(false);
                              navigate(`/kits/${k._id}`);
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl text-xs text-neutral-800 hover:bg-orange-50 hover:text-orange-950 transition-colors flex items-center justify-between group cursor-pointer"
                          >
                            <div className="truncate pr-2">
                              <p className="font-semibold truncate">
                                {k.data?.role?.title || k.role || 'Interview Kit'}
                              </p>
                              <p className="text-[10px] text-neutral-500 truncate">
                                {k.company || k.data?.company_brief?.name || 'Target Company'}
                              </p>
                            </div>
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-100/60 px-1.5 py-0.5 rounded-full shrink-0">
                              {k.data?.questions?.length || 0} Qs
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generate / New Kit button */}
              {onOpenGenerate && (
                <button
                  onClick={onOpenGenerate}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-full transition-all shadow-xs cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Kit</span>
                </button>
              )}

              {/* User Avatar + Logout */}
              <div className="flex items-center gap-2 pl-1">
                <div
                  title={user.email}
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 to-amber-500 text-white font-bold flex items-center justify-center text-xs shadow-xs uppercase"
                >
                  {user.email.charAt(0)}
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-5 py-2 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-full shadow-xs hover:shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Login / Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
