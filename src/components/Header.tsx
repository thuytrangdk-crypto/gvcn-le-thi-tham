import React from 'react';
import { LogOut, User, KeyRound, Sparkles, School, GraduationCap } from 'lucide-react';
import type { UserSession, AppSettings } from '../types';

interface HeaderProps {
  user: UserSession | null;
  settings: AppSettings;
  onLogout: () => void;
  onOpenLogin: () => void;
  onChangePassword: () => void;
  onNavigateHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  settings,
  onLogout,
  onOpenLogin,
  onChangePassword,
  onNavigateHome
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rose-100 shadow-[0_1px_3px_rgba(244,114,182,0.06)] px-4 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Brand & Class Info */}
        <div className="flex items-center gap-3 cursor-pointer select-none" onClick={onNavigateHome}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#E06D85] to-[#F7A8B8] flex items-center justify-center text-white shadow-sm shadow-rose-200">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-800 text-base sm:text-lg tracking-tight leading-tight whitespace-nowrap">
                {settings.appName || 'GVCN – Quản trị lớp chủ nhiệm'}
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 text-xs font-semibold rounded-md bg-rose-50 text-[#C94C67] border border-rose-200/60 whitespace-nowrap">
                Lớp {settings.className}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
              <span className="hidden md:inline font-medium text-slate-600">{settings.schoolName}</span>
              <span className="hidden md:inline text-slate-300">·</span>
              <span>NH: {settings.schoolYear}</span>
              <span className="hidden lg:inline text-slate-300">·</span>
              <span className="hidden lg:inline font-medium text-rose-700">{settings.teacherName}</span>
            </div>
          </div>
        </div>

        {/* Right: Account & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-800 truncate max-w-[150px]">
                  {user.name}
                </div>
                <div className="text-[11px] text-rose-600 font-medium">
                  {user.role === 'teacher' ? 'Giáo viên chủ nhiệm' : `Học sinh (${user.username})`}
                </div>
              </div>

              <div className="relative group">
                <button
                  type="button"
                  title="Tài khoản"
                  className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 transition-colors border border-rose-100 text-xs font-medium"
                >
                  <User className="w-4 h-4 text-[#E06D85]" />
                  <span className="sm:hidden font-medium text-[11px] max-w-[70px] truncate">{user.name}</span>
                </button>
              </div>

              <button
                onClick={onChangePassword}
                type="button"
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50/80 transition-colors border border-slate-200/70 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                title="Đổi mật khẩu"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden md:inline">Đổi MK</span>
              </button>

              <button
                onClick={onLogout}
                type="button"
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors border border-slate-200/70 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              type="button"
              className="px-4 py-1.5 rounded-lg bg-[#E06D85] hover:bg-[#C94C67] text-white text-xs font-semibold transition-all shadow-sm shadow-rose-200 flex items-center gap-1.5 whitespace-nowrap"
            >
              <User className="w-4 h-4" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
