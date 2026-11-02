import React, { useState } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  Sparkles,
  AlertCircle,
  X,
  ShieldCheck,
  KeyRound,
  ArrowRight
} from 'lucide-react';
import type { AppSettings } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (username: string, pass: string) => Promise<void>;
  settings: AppSettings;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  settings
}) => {
  const [activeTab, setActiveTab] = useState<'teacher' | 'student'>('teacher');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [showTeacherPassword, setShowTeacherPassword] = useState(false);

  const [studentCode, setStudentCode] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherPassword.trim()) {
      setError('Vui lòng nhập mật khẩu giáo viên');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onLogin('gvcn', teacherPassword);
      setTeacherPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Mật khẩu giáo viên không chính xác');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim() || !studentPassword) {
      setError('Vui lòng nhập mã học sinh và mật khẩu');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onLogin(studentCode.trim().toUpperCase(), studentPassword);
      setStudentCode('');
      setStudentPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Mã học sinh hoặc mật khẩu không chính xác');
    } finally {
      setLoading(false);
    }
  };

  const currentClassName = settings.className || '7A1';
  const currentSchoolYear = settings.schoolYear || '2025–2026';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-rose-100 space-y-6 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-28 bg-gradient-to-b from-[#FAD2DC] to-transparent rounded-full blur-2xl pointer-events-none opacity-50" />

        <button
          onClick={onClose}
          type="button"
          aria-label="Đóng cửa sổ đăng nhập"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-rose-50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand header */}
        <div className="text-center space-y-2.5 relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#E06D85] to-[#F7A8B8] text-white flex items-center justify-center mx-auto shadow-md shadow-rose-200/80 ring-4 ring-rose-50">
            <GraduationCap className="w-9 h-9" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              GVCN – Quản trị lớp chủ nhiệm
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Đồng hành cùng giáo viên – Kết nối lớp học
            </p>
          </div>

          {/* Dynamic Class & School Year Badge */}
          <div className="pt-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/70 text-[#C94C67] text-xs font-semibold shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-[#E06D85]" />
              <span>Lớp {currentClassName} – Năm học {currentSchoolYear}</span>
            </span>
          </div>
        </div>

        {/* Two Distinct Tabs: Giáo viên & Học sinh */}
        <div className="p-1 bg-slate-100/80 rounded-2xl flex gap-1 border border-slate-200/60">
          <button
            type="button"
            onClick={() => {
              setActiveTab('teacher');
              setError(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'teacher'
                ? 'bg-white text-[#C94C67] shadow-sm border border-rose-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${activeTab === 'teacher' ? 'text-[#E06D85]' : 'text-slate-400'}`} />
            <span>Giáo viên</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('student');
              setError(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'student'
                ? 'bg-white text-[#C94C67] shadow-sm border border-rose-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className={`w-4 h-4 ${activeTab === 'student' ? 'text-[#E06D85]' : 'text-slate-400'}`} />
            <span>Học sinh</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-700 flex items-center gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Tab 1: Giáo viên */}
        {activeTab === 'teacher' && (
          <form onSubmit={handleTeacherSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mật khẩu giáo viên *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showTeacherPassword ? 'text' : 'password'}
                  value={teacherPassword}
                  onChange={e => setTeacherPassword(e.target.value)}
                  placeholder="Nhập mật khẩu giáo viên"
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 rounded-2xl border border-rose-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D85] focus:border-[#E06D85] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowTeacherPassword(!showTeacherPassword)}
                  aria-label="Hiện hoặc ẩn mật khẩu"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  {showTeacherPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-[#E06D85] hover:bg-[#C94C67] text-white text-sm font-bold transition-all shadow-md shadow-rose-200/80 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loading ? 'Đang xác thực...' : 'Đăng nhập Giáo viên'}</span>
            </button>
          </form>
        )}

        {/* Tab 2: Học sinh */}
        {activeTab === 'student' && (
          <form onSubmit={handleStudentSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mã học sinh *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentCode}
                  onChange={e => setStudentCode(e.target.value)}
                  placeholder="Ví dụ: HS01, HS02..."
                  autoFocus
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-rose-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#E06D85] focus:border-[#E06D85] transition-all uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Mật khẩu *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showStudentPassword ? 'text' : 'password'}
                  value={studentPassword}
                  onChange={e => setStudentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu học sinh"
                  className="w-full pl-10 pr-10 py-3 rounded-2xl border border-rose-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D85] focus:border-[#E06D85] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowStudentPassword(!showStudentPassword)}
                  aria-label="Hiện hoặc ẩn mật khẩu"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  {showStudentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 bg-rose-50/50 p-3 rounded-xl border border-rose-100/70 leading-relaxed">
              Mật khẩu mặc định: <strong>Mã học sinh + Ngày sinh (VD: HS0112032009)</strong>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-[#E06D85] hover:bg-[#C94C67] text-white text-sm font-bold transition-all shadow-md shadow-rose-200/80 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
            >
              <ArrowRight className="w-4 h-4" />
              <span>{loading ? 'Đang xác thực...' : 'Đăng nhập Học sinh'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
