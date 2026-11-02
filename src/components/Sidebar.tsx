import React from 'react';
import { LayoutDashboard, Newspaper, Users, Settings, Award, CalendarCheck, BookOpen, Flag } from 'lucide-react';
import type { Role } from '../types';

export type MainTab = 'dashboard' | 'notices_seating' | 'students' | 'conduct' | 'attendance' | 'academics' | 'settings';

interface SidebarProps {
  currentTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  userRole?: Role;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  isOpenMobile,
  onCloseMobile
}) => {
  const primaryNavItems: Array<{ id: MainTab; label: string; icon: React.ElementType; teacherOnly?: boolean }> = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'notices_seating', label: 'Bảng tin & Sơ đồ lớp', icon: Newspaper },
    { id: 'students', label: userRole === 'student' ? 'Hồ sơ của tôi' : 'Học sinh', icon: Users },
    { id: 'conduct', label: 'Thi đua', icon: Flag },
    { id: 'attendance', label: 'Điểm danh', icon: CalendarCheck, teacherOnly: true },
    { id: 'academics', label: 'Học tập', icon: BookOpen, teacherOnly: true },
    { id: 'settings', label: 'Cài đặt', icon: Settings, teacherOnly: true }
  ];

  const visibleItems = primaryNavItems.filter(item => !item.teacherOnly || userRole === 'teacher');

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-rose-100/80 w-64 select-none">
      {/* Navigation list */}
      <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="text-[11px] font-bold uppercase tracking-wider text-rose-900/40 px-3 pb-1">
          Menu Điều Hướng
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-rose-50 text-[#C94C67] font-semibold shadow-xs border border-rose-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/40'
              }`}
            >
              <Icon className={`w-4 h-4 transition-transform ${isActive ? 'text-[#E06D85] scale-110' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Role info badge in bottom sidebar */}
      <div className="p-3 border-t border-rose-100/60 bg-[#FFF9FA]">
        <div className="p-2.5 rounded-xl bg-white border border-rose-100 text-xs shadow-xs">
          <div className="text-[11px] text-slate-400 font-medium">Quyền hạn truy cập</div>
          <div className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${userRole === 'teacher' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
            <span>{userRole === 'teacher' ? 'Giáo viên chủ nhiệm' : 'Học sinh'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 sticky top-[61px] h-[calc(100vh-61px)]">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-xl z-10">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
