import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar, MainTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { NoticeAndSeatingView } from './components/NoticeAndSeatingView';
import { StudentListView } from './components/StudentListView';
import { StudentProfileView } from './components/StudentProfileView';
import { ConductView } from './components/ConductView';
import { AttendanceView } from './components/AttendanceView';
import { AcademicsView } from './components/AcademicsView';
import { SettingsView } from './components/SettingsView';
import { LoginModal } from './components/LoginModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import {
  authApi,
  studentApi,
  seatingApi,
  announcementApi,
  honorApi,
  attendanceApi,
  gradeApi,
  conductApi,
  settingsApi,
  getToken
} from './services/api';
import type {
  UserSession,
  Student,
  AttendanceRecord,
  GradeRecord,
  Announcement,
  Honor,
  ConductLog,
  SeatingLayout,
  Seat,
  AppSettings
} from './types';
import { Menu, LogIn, Sparkles } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    appName: 'GVCN – Quản trị lớp chủ nhiệm',
    schoolName: 'THPT Chuyên Lê Hồng Phong',
    className: '10A1',
    teacherName: 'Cô Nguyễn Thị Mai',
    schoolYear: '2025 - 2026',
    baseConductScore: 100,
    accentColor: '#E06D85',
    conductRules: [],
    evaluationTiers: [],
    subjects: []
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [honors, setHonors] = useState<Honor[]>([]);
  const [conductLogs, setConductLogs] = useState<ConductLog[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [seating, setSeating] = useState<SeatingLayout>({ seats: [], updatedAt: '' });

  // Navigation state
  const [currentTab, setCurrentTab] = useState<MainTab>('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentProfileInitialTab, setStudentProfileInitialTab] = useState<'attendance' | 'academics' | 'conduct' | 'info'>('info');
  const [conductStudentPreset, setConductStudentPreset] = useState<string | undefined>(undefined);

  // Modals & Mobile
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load all app data
  const loadAllData = useCallback(async () => {
    try {
      // 1. Check current session
      const meRes = await authApi.getMe().catch(() => null);
      if (meRes) {
        setUser(meRes.user);
        if (meRes.settings) {
          setSettings(prev => ({ ...prev, ...meRes.settings }));
        }
      } else if (import.meta.env.DEV) {
        // Chỉ tự động đăng nhập demo trong môi trường phát triển (DEV) để thuận tiện kiểm thử
        const autoLogin = await authApi.login('gvcn', 'Gvcn@2026').catch(() => null);
        if (autoLogin) {
          setUser(autoLogin.user);
        }
      }

      // 2. Load core records in parallel
      const [
        studentsRes,
        seatingRes,
        announcementsRes,
        honorsRes,
        attendanceRes,
        conductRes,
        gradesRes,
        settingsRes
      ] = await Promise.all([
        studentApi.getAll().catch(() => []),
        seatingApi.get().catch(() => ({ seats: [], updatedAt: '' })),
        announcementApi.getAll().catch(() => []),
        honorApi.getAll().catch(() => []),
        attendanceApi.get().catch(() => []),
        conductApi.getLogs().catch(() => []),
        gradeApi.get().catch(() => []),
        settingsApi.get().catch(() => null)
      ]);

      setStudents(studentsRes);
      setSeating(seatingRes);
      setAnnouncements(announcementsRes);
      setHonors(honorsRes);
      setAttendance(attendanceRes);
      setConductLogs(conductRes);
      setGrades(gradesRes);
      if (settingsRes) {
        setSettings(settingsRes);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Auth Handlers
  const handleLogin = async (username: string, pass: string) => {
    const res = await authApi.login(username, pass);
    setUser(res.user);
    await loadAllData();
    // If student, open their profile or dashboard
    if (res.user.role === 'student' && res.user.studentId) {
      setSelectedStudentId(res.user.studentId);
      setCurrentTab('students');
    } else {
      setSelectedStudentId(null);
      setCurrentTab('dashboard');
    }
  };

  const handleLogout = () => {
    authApi.logout();
    setUser(null);
    setSelectedStudentId(null);
    setCurrentTab('dashboard');
    setShowLoginModal(true);
  };

  // Seating
  const handleSaveSeating = async (seats: Seat[]) => {
    const res = await seatingApi.update(seats);
    setSeating(res.seating);
  };

  // Announcements
  const handleCreateAnnouncement = async (data: Partial<Announcement>) => {
    const newAnn = await announcementApi.create(data);
    setAnnouncements(prev => [newAnn, ...prev]);
  };

  const handleUpdateAnnouncement = async (id: string, data: Partial<Announcement>) => {
    const updated = await announcementApi.update(id, data);
    setAnnouncements(prev => prev.map(a => a.id === id ? updated : a));
  };

  const handleDeleteAnnouncement = async (id: string) => {
    await announcementApi.delete(id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  // Honors
  const handleCreateHonor = async (data: Partial<Honor>) => {
    const newHon = await honorApi.create(data);
    setHonors(prev => [newHon, ...prev]);
  };

  const handleUpdateHonor = async (id: string, data: Partial<Honor>) => {
    const updated = await honorApi.update(id, data);
    setHonors(prev => prev.map(h => h.id === id ? updated : h));
  };

  const handleDeleteHonor = async (id: string) => {
    await honorApi.delete(id);
    setHonors(prev => prev.filter(h => h.id !== id));
  };

  // Students CRUD
  const handleCreateStudent = async (data: Partial<Student>) => {
    const res = await studentApi.create(data);
    setStudents(prev => [...prev, res.student]);
  };

  const handleUpdateStudent = async (id: string, data: Partial<Student>) => {
    const res = await studentApi.update(id, data);
    setStudents(prev => prev.map(s => s.id === id ? res.student : s));
  };

  const handleDeleteStudent = async (id: string) => {
    await studentApi.delete(id);
    setStudents(prev => prev.filter(s => s.id !== id));
    if (selectedStudentId === id) {
      setSelectedStudentId(null);
    }
  };

  const handleImportStudents = async (studentList: Partial<Student>[]) => {
    const res = await studentApi.import(studentList);
    await loadAllData();
    return res;
  };

  const handleResetStudentPassword = async (studentId: string): Promise<string> => {
    const res = await authApi.resetStudentPassword(studentId);
    return res.defaultPassword;
  };

  // Settings
  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = await settingsApi.update(newSettings);
    setSettings(updated);
  };

  // Navigation helpers
  const handleOpenStudentProfile = (studentId: string, initialTab: 'attendance' | 'academics' | 'conduct' | 'info' = 'info') => {
    setSelectedStudentId(studentId);
    setStudentProfileInitialTab(initialTab);
    setCurrentTab('students');
  };

  const handleRecordConductForStudent = (studentId: string) => {
    setConductStudentPreset(studentId);
    setCurrentTab('conduct');
  };

  // If user is a student, clicking 'students' in sidebar directly opens their own profile
  const handleSelectTab = (tab: MainTab) => {
    if (tab === 'students') {
      if (user?.role === 'student' && user.studentId) {
        setSelectedStudentId(user.studentId);
        setStudentProfileInitialTab('info');
      } else {
        setSelectedStudentId(null);
      }
    }
    setCurrentTab(tab);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFF8F9] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-rose-200 border-t-[#E06D85] rounded-full animate-spin" />
        <div>
          <h2 className="text-lg font-bold text-slate-800">GVCN – Quản trị lớp chủ nhiệm</h2>
          <p className="text-xs text-slate-500 mt-1">Đang khởi tạo hệ thống quản lý giáo dục...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8F9] flex flex-col antialiased">
      {/* Top Header */}
      <Header
        user={user}
        settings={settings}
        onLogout={handleLogout}
        onOpenLogin={() => setShowLoginModal(true)}
        onChangePassword={() => setShowChangePasswordModal(true)}
        onNavigateHome={() => {
          setSelectedStudentId(null);
          setCurrentTab('dashboard');
        }}
      />

      {/* Mobile Bar for Hamburger Menu */}
      <div className="lg:hidden bg-white border-b border-rose-100 px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 rounded-lg text-slate-600 hover:bg-rose-50 flex items-center gap-2 text-xs font-semibold"
        >
          <Menu className="w-5 h-5 text-[#E06D85]" />
          <span>Danh mục chức năng</span>
        </button>

        <span className="text-xs font-bold text-[#C94C67]">
          {currentTab === 'dashboard' && 'Tổng quan'}
          {currentTab === 'notices_seating' && 'Bảng tin & Sơ đồ lớp'}
          {currentTab === 'students' && (selectedStudentId ? 'Hồ sơ học sinh' : 'Học sinh')}
          {currentTab === 'conduct' && 'Thi đua & Rèn luyện'}
          {currentTab === 'attendance' && 'Điểm danh'}
          {currentTab === 'academics' && 'Học tập'}
          {currentTab === 'settings' && 'Cài đặt'}
        </span>
      </div>

      {/* Main Layout (Sidebar + Content Viewport) */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          userRole={user?.role}
          isOpenMobile={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {/* 1. Dashboard View */}
          {currentTab === 'dashboard' && (
            <DashboardView
              students={students}
              attendance={attendance}
              announcements={announcements}
              honors={honors}
              conductLogs={conductLogs}
              settings={settings}
              onNavigateTab={handleSelectTab}
              onOpenStudentProfile={id => handleOpenStudentProfile(id, 'info')}
            />
          )}

          {/* 2. Notices & Seating View */}
          {currentTab === 'notices_seating' && (
            <NoticeAndSeatingView
              announcements={announcements}
              seating={seating}
              honors={honors}
              students={students}
              user={user}
              onSaveSeating={handleSaveSeating}
              onCreateAnnouncement={handleCreateAnnouncement}
              onUpdateAnnouncement={handleUpdateAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
              onCreateHonor={handleCreateHonor}
              onUpdateHonor={handleUpdateHonor}
              onDeleteHonor={handleDeleteHonor}
              onOpenStudentProfile={id => handleOpenStudentProfile(id, 'info')}
            />
          )}

          {/* 3. Students Management / Profile View */}
          {currentTab === 'students' && (
            selectedStudentId ? (
              <StudentProfileView
                studentId={selectedStudentId}
                initialTab={studentProfileInitialTab}
                user={user}
                settings={settings}
                onBack={() => {
                  if (user?.role === 'student') {
                    setCurrentTab('dashboard');
                  } else {
                    setSelectedStudentId(null);
                  }
                }}
                onRecordConduct={handleRecordConductForStudent}
              />
            ) : (
              <StudentListView
                students={students}
                userRole={user?.role || 'teacher'}
                onOpenProfile={(id, initialTab) => handleOpenStudentProfile(id, (initialTab as any) || 'info')}
                onCreateStudent={handleCreateStudent}
                onUpdateStudent={handleUpdateStudent}
                onDeleteStudent={handleDeleteStudent}
                onImportStudents={handleImportStudents}
                onResetPassword={handleResetStudentPassword}
              />
            )
          )}

          {/* 4. Conduct View (Thi đua) */}
          {currentTab === 'conduct' && (
            <ConductView
              students={students}
              rules={settings.conductRules || []}
              conductLogs={conductLogs}
              settings={settings}
              user={user}
              selectedStudentIdPreset={conductStudentPreset}
              onRefreshData={loadAllData}
              onOpenStudentProfile={(id, tab) => handleOpenStudentProfile(id, (tab as any) || 'conduct')}
            />
          )}

          {/* 5. Attendance View (Điểm danh) */}
          {currentTab === 'attendance' && (
            <AttendanceView
              students={students}
              user={user}
              settings={settings}
              onRefreshData={loadAllData}
              onOpenStudentProfile={id => handleOpenStudentProfile(id, 'attendance')}
            />
          )}

          {/* 6. Academics View (Học tập) */}
          {currentTab === 'academics' && (
            <AcademicsView
              students={students}
              grades={grades}
              settings={settings}
              user={user}
              onRefreshData={loadAllData}
              onOpenStudentProfile={id => handleOpenStudentProfile(id, 'academics')}
            />
          )}

          {/* 7. Settings View (Cài đặt) */}
          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onRefreshData={loadAllData}
            />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLogin}
        settings={settings}
      />

      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        userName={user?.name || ''}
      />
    </div>
  );
}
