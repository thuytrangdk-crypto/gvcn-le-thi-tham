import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Newspaper,
  Users,
  Settings,
  CalendarCheck,
  BookOpen,
  Flag,
  KeyRound,
  LogOut,
  ChevronDown,
  Cloud,
  GraduationCap
} from 'lucide-react';
import type { Role, UserSession, AppSettings } from '../types';
import { supabaseApi } from '../services/api';

export type MainTab = 'dashboard' | 'notices_seating' | 'students' | 'conduct' | 'attendance' | 'academics' | 'settings';

interface SidebarProps {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  userRole?: Role;
  user: UserSession | null;
  settings: AppSettings;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  onChangePassword: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  user,
  settings,
  isOpenMobile,
  onCloseMobile,
  onLogout,
  onChangePassword
}) => {
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(true);

  // Ping Supabase status periodically
  useEffect(() => {
    supabaseApi.getStatus()
      .then(res => {
        if (res.isConfigured) {
          setSupabaseConnected(true);
        }
      })
      .catch(() => {
        setSupabaseConnected(false);
      });
  }, []);

  const primaryNavItems: Array<{ id: MainTab; label: string; icon: React.ElementType; teacherOnly?: boolean }> = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'notices_seating', label: 'Bảng tin & Sơ đồ lớp', icon: Newspaper },
    { id: 'students', label: userRole === 'student' ? 'Hồ sơ của tôi' : 'Học sinh', icon: Users },
    { id: 'academics', label: 'Học tập', icon: BookOpen, teacherOnly: true },
    { id: 'attendance', label: 'Điểm danh', icon: CalendarCheck, teacherOnly: true },
    { id: 'conduct', label: 'Thi đua', icon: Flag },
    { id: 'settings', label: 'Cài đặt', icon: Settings, teacherOnly: true }
  ];

  const visibleItems = primaryNavItems.filter(item => !item.teacherOnly || userRole === 'teacher');

  const content = (
    <div className="flex flex-col h-full bg-[#FAFCFD] border-r border-rose-100/90 w-64 lg:w-72 select-none">
      {/* 1. Top Branding Header (8A3 Style) */}
      <div className="p-4 sm:p-5 border-b border-rose-100/80 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#E06D85] to-[#F59EB0] flex items-center justify-center text-white shadow-md shadow-rose-200/70 shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-extrabold text-slate-800 text-sm tracking-tight leading-tight uppercase truncate">
              {settings.appName || 'TRỢ LÝ CHỦ NHIỆM'}
            </h1>
            <div className="mt-1 flex items-center">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-50 text-[#C94C67] text-xs font-bold border border-rose-200/80 shadow-2xs">
                <span>Lớp {settings.className || '7A1'}</span>
                <ChevronDown className="w-3 h-3 text-[#E06D85]" />
              </span>
            </div>
          </div>
        </div>

        {/* Teacher subtitle */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600 font-medium">
          <span className="w-2 h-2 rounded-full bg-[#E06D85] shrink-0" />
          <span className="truncate">GVCN: <strong className="text-slate-800">{settings.teacherName || 'Cô Lê Thị Thắm'}</strong></span>
        </div>

        {/* Supabase status pill */}
        <div className="mt-2.5">
          <div
            className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors ${
              supabaseConnected
                ? 'bg-emerald-50/70 text-emerald-800 border-emerald-200/80'
                : 'bg-rose-50/70 text-rose-800 border-rose-200/80'
            }`}
            title="Kết nối cơ sở dữ liệu Supabase dự án thuy-trang"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Cloud className={`w-3.5 h-3.5 ${supabaseConnected ? 'text-emerald-600' : 'text-rose-500'}`} />
              <span className="truncate">Supabase: {supabaseConnected ? 'Đã kết nối' : 'Chưa kết nối'}</span>
            </div>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                supabaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'
              }`}
            />
          </div>
        </div>
      </div>

      {/* 2. Navigation Menu */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1.5">
          Danh mục chức năng
        </div>

        {visibleItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/50'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-transform duration-150 ${
                  isActive ? 'text-[#E06D85] scale-110' : 'text-slate-400'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}

        {/* System Sub-section (8A3 Style) */}
        {userRole === 'teacher' && (
          <div className="pt-4 mt-2 border-t border-rose-100/60">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1.5">
              Hệ thống
            </div>
            <button
              onClick={() => {
                onChangePassword();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-medium text-slate-600 hover:text-rose-800 hover:bg-rose-50/50 transition-colors"
            >
              <KeyRound className="w-4 h-4 text-slate-400" />
              <span>Đổi mật khẩu GV</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Bottom Footer User Role & Logout (8A3 Style) */}
      <div className="p-3 sm:p-4 border-t border-rose-100/80 bg-white">
        <div className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-[#FFF9FA] border border-rose-100/80">
          <div className="min-w-0">
            <div className="font-bold text-xs text-slate-800 truncate">
              {user ? (userRole === 'teacher' ? 'Giáo viên' : user.name) : 'Chưa đăng nhập'}
            </div>
            <div className="text-[11px] text-slate-400 font-medium truncate">
              {userRole === 'teacher' ? 'Quyền quản lý' : 'Tài khoản học sinh'}
            </div>
          </div>

          {user && (
            <button
              onClick={onLogout}
              className="px-2.5 py-1.5 rounded-xl text-rose-700 hover:bg-rose-100/80 text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
              title="Đăng xuất khỏi tài khoản"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Thoát</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen z-30">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
