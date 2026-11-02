import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  Shield,
  Sliders,
  BookOpen,
  Database,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  Cloud,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Terminal,
  AlertTriangle,
  Calendar,
  RotateCcw,
  FileArchive,
  X
} from 'lucide-react';
import type { AppSettings, ConductRule, Subject, EvaluationTier } from '../types';
import { settingsApi, authApi, backupApi, supabaseApi } from '../services/api';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onRefreshData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onRefreshData
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'rules' | 'subjects' | 'backup' | 'supabase'>('general');
  const backupInputRef = useRef<HTMLInputElement>(null);

  // Supabase Integration State
  const [supabaseStatus, setSupabaseStatus] = useState<{
    projectName: string;
    isConfigured: boolean;
    url: string;
    hasKey: boolean;
  } | null>(null);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedMigration, setCopiedMigration] = useState(false);
  const [copiedReset, setCopiedReset] = useState(false);
  const [sqlViewMode, setSqlViewMode] = useState<'reset' | 'migration' | 'schema'>('reset');

  // Modal Kết thúc năm học – Khởi tạo năm học mới
  const [showResetYearModal, setShowResetYearModal] = useState(false);
  const [resetNewClassName, setResetNewClassName] = useState('');
  const [resetNewSchoolYear, setResetNewSchoolYear] = useState('');
  const [resetNewSchoolName, setResetNewSchoolName] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResettingYear, setIsResettingYear] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  useEffect(() => {
    supabaseApi.getStatus().then(setSupabaseStatus).catch(() => {});
  }, []);

  // Tab A: General Settings
  const [appName, setAppName] = useState(settings.appName || '');
  const [schoolName, setSchoolName] = useState(settings.schoolName || '');
  const [className, setClassName] = useState(settings.className || '');
  const [teacherName, setTeacherName] = useState(settings.teacherName || '');
  const [schoolYear, setSchoolYear] = useState(settings.schoolYear || '');
  const [baseConductScore, setBaseConductScore] = useState(settings.baseConductScore || 100);
  const [accentColor, setAccentColor] = useState(settings.accentColor || '#E06D85');

  // Change Password state
  const [curPassword, setCurPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tab B: Rules & Evaluation Tiers
  const [rules, setRules] = useState<ConductRule[]>(settings.conductRules || []);
  const [tiers, setTiers] = useState<EvaluationTier[]>(settings.evaluationTiers || []);
  const [editingRule, setEditingRule] = useState<ConductRule | null>(null);
  const [newRule, setNewRule] = useState<Partial<ConductRule>>({
    code: 'TC-NEW',
    name: '',
    points: 5,
    category: 'Học tập',
    linkAttendance: false,
    attendanceStatus: 'present'
  });

  // Tab C: Subjects
  const [subjects, setSubjects] = useState<Subject[]>(settings.subjects || []);
  const [newSubject, setNewSubject] = useState<Partial<Subject>>({
    code: '',
    name: '',
    type: 'score',
    isActive: true,
    order: (settings.subjects?.length || 0) + 1
  });

  // Backup / Restore message
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingMsg, setSavingMsg] = useState<string | null>(null);

  // Save General
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateSettings({
        appName,
        schoolName,
        className,
        teacherName,
        schoolYear,
        baseConductScore: Number(baseConductScore),
        accentColor
      });
      setSavingMsg('Đã lưu cấu hình chung và áp dụng ngay trên toàn ứng dụng!');
      setTimeout(() => setSavingMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu cài đặt');
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (!curPassword || !newPassword) {
      setPasswordMsg({ type: 'error', text: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Xác nhận mật khẩu mới không khớp' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
      return;
    }

    try {
      await authApi.changePassword(curPassword, newPassword);
      setPasswordMsg({ type: 'success', text: 'Đổi mật khẩu giáo viên thành công!' });
      setCurPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Mật khẩu hiện tại không chính xác' });
    }
  };

  // Save Rules
  const handleAddRule = async () => {
    if (!newRule.name?.trim() || !newRule.code?.trim()) return;
    const ruleItem: ConductRule = {
      id: `R-${Date.now()}`,
      code: newRule.code.trim().toUpperCase(),
      name: newRule.name.trim(),
      points: Number(newRule.points) || 1,
      category: newRule.category as any || 'Học tập',
      linkAttendance: Boolean(newRule.linkAttendance),
      attendanceStatus: newRule.attendanceStatus
    };
    const updated = [...rules, ruleItem];
    setRules(updated);
    await onUpdateSettings({ conductRules: updated });
    setNewRule({
      code: 'TC-NEW',
      name: '',
      points: 5,
      category: 'Học tập',
      linkAttendance: false,
      attendanceStatus: 'present'
    });
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa quy tắc thi đua này? Các sự việc đã ghi nhận trong quá khứ vẫn giữ nguyên điểm lịch sử.')) return;
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    await onUpdateSettings({ conductRules: updated });
  };

  // Save Subjects
  const handleAddSubject = async () => {
    if (!newSubject.name?.trim() || !newSubject.code?.trim()) return;
    const subItem: Subject = {
      id: `SUB-${newSubject.code.trim().toUpperCase()}`,
      code: newSubject.code.trim().toUpperCase(),
      name: newSubject.name.trim(),
      type: newSubject.type as any || 'score',
      isActive: true,
      order: subjects.length + 1
    };
    const updated = [...subjects, subItem];
    setSubjects(updated);
    await onUpdateSettings({ subjects: updated });
    setNewSubject({
      code: '',
      name: '',
      type: 'score',
      isActive: true,
      order: updated.length + 1
    });
  };

  const handleToggleSubject = async (id: string) => {
    const updated = subjects.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s);
    setSubjects(updated);
    await onUpdateSettings({ subjects: updated });
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Cảnh báo: Bạn có chắc chắn muốn xóa môn học này? Nếu đã có điểm nhập cho môn này, điểm có thể bị ẩn khỏi bảng điểm.')) return;
    const updated = subjects.filter(s => s.id !== id);
    setSubjects(updated);
    await onUpdateSettings({ subjects: updated });
  };

  // Backup Export
  const handleExportBackup = () => {
    window.location.href = backupApi.exportUrl();
  };

  // Backup Restore
  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('CẢNH BÁO: Khôi phục sao lưu sẽ GHI ĐÈ toàn bộ dữ liệu học sinh, điểm số, điểm danh và thi đua hiện tại bằng dữ liệu trong file sao lưu. Bạn có chắc chắn muốn tiếp tục?')) {
      return;
    }

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload.data && !payload.teacher) {
        throw new Error('Định dạng file sao lưu không hợp lệ');
      }
      const dataToRestore = payload.data || payload;
      await backupApi.restore(dataToRestore);
      setBackupMsg({ type: 'success', text: 'Khôi phục bản sao lưu thành công! Đang đồng bộ lại giao diện...' });
      setTimeout(async () => {
        await onRefreshData();
      }, 1500);
    } catch (err: any) {
      setBackupMsg({ type: 'error', text: `Khôi phục thất bại: ${err.message}` });
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  // Mở modal Kết thúc năm học – Khởi tạo năm học mới
  const handleOpenResetModal = () => {
    let nextYear = '2026 - 2027';
    if (settings.schoolYear && settings.schoolYear.includes('-')) {
      const parts = settings.schoolYear.split('-').map(p => parseInt(p.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        nextYear = `${parts[0] + 1} - ${parts[1] + 1}`;
      }
    }
    setResetNewClassName(settings.className || '7A1');
    setResetNewSchoolName(settings.schoolName || 'THPT Chuyên Lê Hồng Phong');
    setResetNewSchoolYear(nextYear);
    setResetConfirmText('');
    setResetError(null);
    setShowResetYearModal(true);
  };

  // Xác nhận thực hiện kết thúc năm học cũ & khởi tạo năm mới
  const handleConfirmResetSchoolYear = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'KHOI TAO NAM HOC MOI') {
      setResetError('Vui lòng nhập chính xác từ khóa "KHOI TAO NAM HOC MOI" để tiếp tục.');
      return;
    }
    setIsResettingYear(true);
    setResetError(null);
    try {
      const res = await settingsApi.resetSchoolYear({
        newClassName: resetNewClassName,
        newSchoolName: resetNewSchoolName,
        newSchoolYear: resetNewSchoolYear,
        confirmText: resetConfirmText.trim()
      });
      setClassName(res.settings.className);
      setSchoolName(res.settings.schoolName);
      setSchoolYear(res.settings.schoolYear);
      setShowResetYearModal(false);
      setResetSuccess(res.message || 'Đã kết thúc năm học cũ và khởi tạo năm học mới thành công!');
      await onRefreshData();
      setTimeout(() => setResetSuccess(null), 6000);
    } catch (err: any) {
      setResetError(err.message || 'Lỗi khi khởi tạo năm học mới');
    } finally {
      setIsResettingYear(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-rose-100 shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'general'
              ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/30'
          }`}
        >
          <Settings className="w-4 h-4 text-[#E06D85]" />
          <span>A. Cài đặt chung</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'rules'
              ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/30'
          }`}
        >
          <Sliders className="w-4 h-4 text-[#E06D85]" />
          <span>B. Quy tắc thi đua</span>
        </button>

        <button
          onClick={() => setActiveTab('subjects')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'subjects'
              ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/30'
          }`}
        >
          <BookOpen className="w-4 h-4 text-[#E06D85]" />
          <span>C. Môn học</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'backup'
              ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/30'
          }`}
        >
          <Database className="w-4 h-4 text-[#E06D85]" />
          <span>D. Dữ liệu & Sao lưu</span>
        </button>

        <button
          onClick={() => setActiveTab('supabase')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'supabase'
              ? 'bg-emerald-50 text-emerald-800 shadow-xs border border-emerald-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-emerald-50/40'
          }`}
        >
          <Cloud className="w-4 h-4 text-emerald-600" />
          <span>E. Kết nối Supabase (thuy-trang)</span>
        </button>
      </div>

      {savingMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savingMsg}</span>
        </div>
      )}

      {/* ================= TAB A: CÀI ĐẶT CHUNG ================= */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* General Information Form */}
          <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-base pb-3 border-b border-rose-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#E06D85]" />
              <span>Thông tin nhà trường & Lớp chủ nhiệm</span>
            </h3>

            <form onSubmit={handleSaveGeneral} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên ứng dụng hiển thị *
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={e => setAppName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-slate-800 font-bold focus:ring-2 focus:ring-[#E06D85]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Tên lớp *
                  </label>
                  <input
                    type="text"
                    value={className}
                    onChange={e => setClassName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-slate-800 font-bold focus:ring-2 focus:ring-[#E06D85]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Năm học *
                  </label>
                  <input
                    type="text"
                    value={schoolYear}
                    onChange={e => setSchoolYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-slate-800 font-bold focus:ring-2 focus:ring-[#E06D85]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên trường học *
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={e => setSchoolName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-slate-800 font-semibold focus:ring-2 focus:ring-[#E06D85]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Họ và tên Giáo viên chủ nhiệm *
                </label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={e => setTeacherName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-slate-800 font-semibold focus:ring-2 focus:ring-[#E06D85]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Điểm thi đua khởi tạo kỳ
                  </label>
                  <input
                    type="number"
                    value={baseConductScore}
                    onChange={e => setBaseConductScore(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 font-mono font-bold text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Thường là 100 điểm hoặc 0 điểm</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Màu sắc điểm nhấn
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={e => setAccentColor(e.target.value)}
                      className="w-10 h-9 p-0.5 rounded-lg border border-rose-200 cursor-pointer"
                    />
                    <span className="font-mono text-xs text-slate-600">{accentColor}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#E06D85] text-white font-bold hover:bg-[#C94C67] flex items-center gap-1.5 shadow-sm shadow-rose-200"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu cài đặt chung</span>
                </button>
              </div>
            </form>
          </div>

          {/* Change Teacher Password */}
          <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-base pb-3 border-b border-rose-100 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#E06D85]" />
                <span>Bảo mật & Đổi mật khẩu GVCN</span>
              </h3>

              {passwordMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 mt-3 ${
                  passwordMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
                }`}>
                  {passwordMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                  <span>{passwordMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4 text-xs mt-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mật khẩu hiện tại *
                  </label>
                  <input
                    type="password"
                    value={curPassword}
                    onChange={e => setCurPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mật khẩu mới (tối thiểu 6 ký tự) *
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới an toàn"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nhập lại mật khẩu mới *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Xác nhận lại mật khẩu mới"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 flex items-center gap-1.5"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Cập nhật mật khẩu</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 mt-6 leading-relaxed">
              Mật khẩu được mã hóa và băm chuẩn an toàn PBKDF2 bằng chuỗi muối ngẫu nhiên (salt) trên máy chủ, ngăn chặn lộ thông tin.
            </div>
          </div>

          {/* Card: Quản lý chu kỳ năm học (Một năm học hiện tại) */}
          <div className="lg:col-span-2 bg-gradient-to-br from-rose-50/70 via-white to-pink-50/60 rounded-3xl p-6 sm:p-7 border border-rose-200 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-[#C94C67] flex items-center justify-center shrink-0 shadow-xs">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 text-base">Chu kỳ năm học (Một năm học hiện tại)</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-[#C94C67]">
                      Năm học hiện tại: {settings.schoolYear}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Hệ thống hoạt động theo nguyên tắc quản lý độc lập 1 năm học. Khi kết thúc năm học, giáo viên có thể làm mới toàn bộ danh sách lớp, điểm số và chuyên cần để đón khóa học sinh mới mà không ảnh hưởng tới tài khoản và quyền quản trị.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenResetModal}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#E06D85] to-[#C94C67] hover:from-[#d55972] hover:to-[#b63c55] text-white text-xs font-bold transition-all shadow-sm shadow-rose-200 flex items-center gap-2 shrink-0 self-start sm:self-auto cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Kết thúc năm học – Khởi tạo năm học mới</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-white border border-rose-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Lớp hiện tại</span>
                <span className="text-sm font-bold text-slate-800 mt-0.5 block">{settings.className}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-rose-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Trường phụ trách</span>
                <span className="text-sm font-bold text-slate-800 mt-0.5 block truncate">{settings.schoolName}</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-rose-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Chế độ bảo mật</span>
                <span className="text-sm font-bold text-emerald-700 mt-0.5 block">Xác nhận 2 lớp & Tải sao lưu</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB B: QUY TẮC THI ĐUA ================= */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Add New Rule */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-rose-100 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-base pb-2 border-b border-rose-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#E06D85]" />
              <span>Thêm quy tắc thi đua mới</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mã quy tắc *</label>
                <input
                  type="text"
                  value={newRule.code}
                  onChange={e => setNewRule({ ...newRule, code: e.target.value.toUpperCase() })}
                  placeholder="VD: TC-05"
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 uppercase font-mono font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Tên sự việc thi đua *</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="Ví dụ: Đạt giải kỳ thi Violympic Toán..."
                  className="w-full px-3 py-2 rounded-xl border border-rose-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Điểm cộng / trừ *</label>
                <input
                  type="number"
                  value={newRule.points}
                  onChange={e => setNewRule({ ...newRule, points: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-center">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nhóm sự việc</label>
                <select
                  value={newRule.category}
                  onChange={e => setNewRule({ ...newRule, category: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-rose-200"
                >
                  <option value="Học tập">Học tập</option>
                  <option value="Nề nếp">Nề nếp</option>
                  <option value="Chuyên cần">Chuyên cần</option>
                  <option value="Hoạt động phong trào">Hoạt động phong trào</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer mt-5">
                  <input
                    type="checkbox"
                    checked={newRule.linkAttendance}
                    onChange={e => setNewRule({ ...newRule, linkAttendance: e.target.checked })}
                    className="rounded text-[#E06D85]"
                  />
                  <span className="font-semibold text-slate-700">Liên kết tự động điểm danh</span>
                </label>
              </div>

              {newRule.linkAttendance && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Trạng thái điểm danh</label>
                  <select
                    value={newRule.attendanceStatus}
                    onChange={e => setNewRule({ ...newRule, attendanceStatus: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-rose-200"
                  >
                    <option value="late">Đi muộn</option>
                    <option value="unexcused_absence">Vắng không phép</option>
                    <option value="excused_absence">Vắng có phép</option>
                    <option value="present">Có mặt</option>
                  </select>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleAddRule}
                disabled={!newRule.name?.trim()}
                className="px-4 py-2 rounded-xl bg-[#E06D85] text-white font-bold hover:bg-[#C94C67] disabled:opacity-50"
              >
                Thêm quy tắc
              </button>
            </div>
          </div>

          {/* Rules List Table */}
          <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-rose-100">
              <h4 className="font-bold text-slate-800 text-sm">Danh mục quy tắc thi đua ({rules.length} quy tắc)</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF8F9] border-b border-rose-100 text-slate-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Mã</th>
                    <th className="py-2.5 px-4">Tên quy tắc sự việc</th>
                    <th className="py-2.5 px-4">Nhóm</th>
                    <th className="py-2.5 px-4 text-center">Điểm</th>
                    <th className="py-2.5 px-4">Liên kết chuyên cần</th>
                    <th className="py-2.5 px-4 text-right">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50 text-slate-700">
                  {rules.map(r => (
                    <tr key={r.id} className="hover:bg-rose-50/20">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{r.code}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{r.name}</td>
                      <td className="py-2.5 px-4 text-slate-600">{r.category}</td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                          r.points > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {r.points > 0 ? `+${r.points}` : r.points}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {r.linkAttendance ? (
                          <span className="font-semibold text-amber-700">
                            ⚡ {r.attendanceStatus === 'late' ? 'Đi muộn' : r.attendanceStatus === 'unexcused_absence' ? 'Không phép' : 'Chuyên cần'}
                          </span>
                        ) : (
                          <span className="text-slate-400">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteRule(r.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50"
                          title="Xóa quy tắc"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB C: MÔN HỌC ================= */}
      {activeTab === 'subjects' && (
        <div className="space-y-6">
          {/* Add Subject */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-rose-100 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-800 text-base pb-2 border-b border-rose-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#E06D85]" />
              <span>Thêm môn học mới</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mã môn *</label>
                <input
                  type="text"
                  value={newSubject.code}
                  onChange={e => setNewSubject({ ...newSubject, code: e.target.value.toUpperCase() })}
                  placeholder="VD: GDQP"
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 uppercase font-mono font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Tên môn học *</label>
                <input
                  type="text"
                  value={newSubject.name}
                  onChange={e => setNewSubject({ ...newSubject, name: e.target.value })}
                  placeholder="Ví dụ: Giáo dục quốc phòng & an ninh"
                  className="w-full px-3 py-2 rounded-xl border border-rose-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Hình thức đánh giá</label>
                <select
                  value={newSubject.type}
                  onChange={e => setNewSubject({ ...newSubject, type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-rose-200"
                >
                  <option value="score">Điểm số (thang 0-10)</option>
                  <option value="qualitative">Nhận xét (Đạt / Chưa đạt)</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleAddSubject}
                disabled={!newSubject.name?.trim() || !newSubject.code?.trim()}
                className="px-4 py-2 rounded-xl bg-[#E06D85] text-white font-bold hover:bg-[#C94C67] disabled:opacity-50"
              >
                Thêm môn học
              </button>
            </div>
          </div>

          {/* Subjects Table */}
          <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-rose-100">
              <h4 className="font-bold text-slate-800 text-sm">Danh sách môn học lớp ({subjects.length} môn)</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF8F9] border-b border-rose-100 text-slate-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4 w-16">STT</th>
                    <th className="py-2.5 px-4">Mã môn</th>
                    <th className="py-2.5 px-4">Tên môn học</th>
                    <th className="py-2.5 px-4">Hình thức</th>
                    <th className="py-2.5 px-4 text-center">Trạng thái áp dụng</th>
                    <th className="py-2.5 px-4 text-right">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50 text-slate-700">
                  {subjects.map((sub, i) => (
                    <tr key={sub.id} className="hover:bg-rose-50/20">
                      <td className="py-2.5 px-4 font-mono text-slate-400">{i + 1}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800">{sub.code}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{sub.name}</td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {sub.type === 'score' ? 'Chấm điểm (0 - 10)' : 'Đánh giá nhận xét'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleSubject(sub.id)}
                          className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-colors ${
                            sub.isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {sub.isActive ? 'Đang kích hoạt' : 'Đang tạm dừng'}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteSubject(sub.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50"
                          title="Xóa môn học"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB D: DỮ LIỆU & SAO LƯU ================= */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export Backup Card */}
          <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <Download className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-900 text-base">Xuất bản sao lưu dữ liệu toàn bộ</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tải về tệp sao lưu chuẩn JSON chứa toàn bộ danh sách học sinh, mật khẩu đã băm, điểm danh, bảng điểm, thi đua và sơ đồ lớp để lưu trữ an toàn ngoại tuyến.
              </p>
            </div>

            <div className="pt-4 border-t border-rose-50">
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Tải về file sao lưu (.JSON)</span>
              </button>
            </div>
          </div>

          {/* Restore Backup Card */}
          <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-900 text-base">Khôi phục dữ liệu từ bản sao lưu</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Chọn tệp .JSON sao lưu đã xuất trước đó. Hệ thống sẽ kiểm tra tính toàn vẹn và xác nhận trước khi ghi đè dữ liệu.
              </p>

              {backupMsg && (
                <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 mt-3 ${
                  backupMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
                }`}>
                  {backupMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                  <span>{backupMsg.text}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-rose-50">
              <input
                type="file"
                ref={backupInputRef}
                accept=".json"
                className="hidden"
                onChange={handleRestoreFile}
              />
              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Chọn file .JSON khôi phục</span>
              </button>
            </div>
          </div>

          {/* Card: Quản lý chu kỳ năm học trong Tab D */}
          <div className="md:col-span-2 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-rose-50 via-pink-50/50 to-white border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#E06D85] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-slate-900 text-sm">Chuyển tiếp chu kỳ năm học (Một năm học hiện tại)</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-[#C94C67]">
                    Đang quản lý: {settings.schoolYear}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Khi hoàn thành năm học cũ, hãy tải file sao lưu ở mục trên, sau đó khởi tạo năm học mới để làm sạch dữ liệu lớp đón học sinh mới.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenResetModal}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E06D85] to-[#C94C67] hover:from-[#d55972] hover:to-[#b63c55] text-white text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Kết thúc năm học – Khởi tạo năm học mới</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB E: KẾT NỐI SUPABASE (THUY-TRANG) ================= */}
      {activeTab === 'supabase' && (
        <div className="space-y-6">
          {/* Status & Connection Test Box */}
          <div className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-emerald-100/70">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Cloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>Project Supabase: thuy-trang</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      supabaseStatus?.isConfigured
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {supabaseStatus?.isConfigured ? '● Đã nhận biến môi trường' : '○ Chờ cấu hình biến môi trường'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hệ thống đọc Project URL và Publishable Anon Key trực tiếp từ biến môi trường, bảo đảm không lộ khoá trong mã nguồn.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={async () => {
                    setIsTestingSupabase(true);
                    setTestResult(null);
                    try {
                      const res = await supabaseApi.testConnection();
                      setTestResult(res);
                    } catch (err: any) {
                      setTestResult({ success: false, message: err.message || 'Lỗi kiểm tra kết nối' });
                    } finally {
                      setIsTestingSupabase(false);
                    }
                  }}
                  disabled={isTestingSupabase}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                  <span>{isTestingSupabase ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
                </button>

                {supabaseStatus?.isConfigured && (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsSyncingSupabase(true);
                      setSyncResult(null);
                      try {
                        const res = await supabaseApi.syncUp();
                        setSyncResult(res);
                      } catch (err: any) {
                        setSyncResult({ success: false, message: err.message || 'Lỗi đồng bộ' });
                      } finally {
                        setIsSyncingSupabase(false);
                      }
                    }}
                    disabled={isSyncingSupabase}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isSyncingSupabase ? 'Đang đồng bộ...' : 'Đồng bộ cấu hình & sơ đồ lên Supabase'}</span>
                  </button>
                )}
              </div>
            </div>

            {testResult && (
              <div className={`p-4 rounded-2xl text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border border-amber-200 text-amber-900'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-bold">{testResult.success ? 'Thông báo kết nối thành công' : 'Lưu ý kết nối'}</div>
                  <p className="leading-relaxed">{testResult.message}</p>
                </div>
              </div>
            )}

            {syncResult && (
              <div className={`p-4 rounded-2xl text-xs flex items-start gap-2.5 ${
                syncResult.success
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border border-red-200 text-red-900'
              }`}>
                {syncResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{syncResult.success ? 'Đồng bộ thành công' : 'Lỗi đồng bộ'}</div>
                  <p className="leading-relaxed">{syncResult.message}</p>
                </div>
              </div>
            )}

            {/* Environment Variables summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Biến Project URL (VITE_SUPABASE_URL)</div>
                <div className="font-mono text-slate-800 break-all">
                  {supabaseStatus?.url || '<Chưa đặt trong biến môi trường>'}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Publishable Key (VITE_SUPABASE_PUBLISHABLE_KEY)</div>
                <div className="font-mono text-slate-800">
                  {supabaseStatus?.hasKey ? '•••••••••••••••••••••••• (Đã nhận an toàn)' : '<Chưa đặt trong biến môi trường>'}
                </div>
              </div>
            </div>
          </div>

          {/* Checklist: Các bước cần thực hiện trong Supabase trước khi sử dụng */}
          <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-rose-100">
              <ShieldCheck className="w-5 h-5 text-[#E06D85]" />
              <h3 className="font-bold text-slate-900 text-base">
                Các bước thực hiện trong Supabase (Project: thuy-trang) trước khi sử dụng
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-2">
                <div className="w-7 h-7 rounded-xl bg-[#E06D85] text-white flex items-center justify-center font-bold">1</div>
                <h4 className="font-bold text-slate-800 text-sm">Lấy Project URL & Key</h4>
                <p className="text-slate-600 leading-relaxed">
                  Đăng nhập Supabase, mở project <strong>thuy-trang</strong> &gt; vào <strong>Project Settings &gt; API</strong> lấy URL và Publishable key (hoặc anon key).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-2">
                <div className="w-7 h-7 rounded-xl bg-[#E06D85] text-white flex items-center justify-center font-bold">2</div>
                <h4 className="font-bold text-slate-800 text-sm">Điền biến môi trường</h4>
                <p className="text-slate-600 leading-relaxed">
                  Thiết lập <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> trong Secrets/Environment panel.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-2">
                <div className="w-7 h-7 rounded-xl bg-[#E06D85] text-white flex items-center justify-center font-bold">3</div>
                <h4 className="font-bold text-slate-800 text-sm">Chạy SQL Schema & RLS</h4>
                <p className="text-slate-600 leading-relaxed">
                  Vào <strong>SQL Editor</strong> trong Supabase, dán toàn bộ mã <code>schema.sql</code> và bấm <strong>Run</strong> để tạo bảng và chính sách bảo mật.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-2">
                <div className="w-7 h-7 rounded-xl bg-[#E06D85] text-white flex items-center justify-center font-bold">4</div>
                <h4 className="font-bold text-slate-800 text-sm">Cấp quyền GVCN đầu tiên</h4>
                <p className="text-slate-600 leading-relaxed">
                  Đăng ký email tại <strong>Authentication &gt; Users</strong>, sau đó vào <strong>SQL Editor</strong> gán quyền teacher an toàn bằng câu lệnh UPDATE với đúng UUID.
                </p>
              </div>
            </div>
          </div>

          {/* Database Tables Proposal & RLS Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs space-y-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#E06D85]" />
                <span>10 Bảng dữ liệu cốt lõi & Hỗ trợ đa lớp độc lập</span>
              </h4>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
                <li><strong>profiles</strong>: Mặc định <code>assigned_class_id = NULL</code> và <code>approval_status = 'pending'</code>. Tài khoản mới phải chờ phê duyệt.</li>
                <li><strong>class_settings</strong>: Cấu hình lớp độc lập theo <code>class_id</code> (10A1, 10A2...), quy tắc, môn học.</li>
                <li><strong>students</strong>: Quản lý học sinh với khóa kép <code>UNIQUE (id, class_id)</code>.</li>
                <li><strong>seating_layout</strong>: Khóa chính phức hợp <code>PRIMARY KEY (class_id, id)</code> cho phép lưu sơ đồ nhiều lớp không trùng lặp.</li>
                <li><strong>announcements</strong>: Bảng tin thông báo lớp học (phân loại bài đăng đã xuất bản).</li>
                <li><strong>honors</strong>: Khóa ngoại <code>(student_id, class_id)</code> chặn vinh danh sai lớp.</li>
                <li><strong>attendance</strong>: Khóa ngoại <code>(student_id, class_id)</code> chặn điểm danh học sinh lớp khác.</li>
                <li><strong>grades</strong>: Khóa ngoại <code>(student_id, class_id)</code> chặn nhập điểm học sinh lớp khác.</li>
                <li><strong>conduct_logs</strong>: Khóa ngoại <code>(student_id, class_id)</code> chặn cộng/trừ điểm thi đua sai lớp.</li>
                <li><strong>period_evaluations</strong>: Khóa ngoại <code>(student_id, class_id)</code> chặn đánh giá sai lớp.</li>
              </ul>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs space-y-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Bảo mật Phê duyệt & Row Level Security (RLS) v2.0</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tất cả các bảng đều được bảo vệ nghiêm ngặt bằng <strong>Row Level Security (RLS)</strong> và Trigger kiểm soát:
              </p>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
                <li><strong>Chế độ chờ phê duyệt</strong>: Người dùng mới (<code>approval_status = 'pending'</code>) bị chặn 100% không thể xem thông báo, sơ đồ lớp hoặc danh sách học sinh.</li>
                <li><strong>Chống can thiệp quyền hạn</strong>: Trigger <code>trg_check_profile_role</code> chặn 100% việc tự sửa <code>role</code>, <code>student_id</code>, <code>assigned_class_id</code> hoặc <code>approval_status</code>.</li>
                <li><strong>Phân quyền lớp độc lập</strong>: Dùng <code>is_teacher_of_class(class_id)</code>, giáo viên chỉ quản lý đúng lớp được phê duyệt.</li>
                <li><strong>Học sinh chỉ xem dữ liệu của mình</strong>: Chỉ học sinh đã được duyệt mới xem được hồ sơ, điểm, điểm danh và thi đua của chính bản thân mình.</li>
              </ul>
            </div>
          </div>

          {/* SQL Script Viewer & 1-Click Copy */}
          <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">Khuyên dùng</span>
                  <h4 className="font-bold text-slate-900 text-sm">Tệp mã SQL dành cho Supabase SQL Editor</h4>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chọn script phù hợp để thực thi trong Supabase mà không làm mất dữ liệu.
                </p>
              </div>

              {/* Toggle script */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
                <button
                  type="button"
                  onClick={() => setSqlViewMode('reset')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sqlViewMode === 'reset'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🔄 Reset Năm học
                </button>
                <button
                  type="button"
                  onClick={() => setSqlViewMode('migration')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sqlViewMode === 'migration'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  ⚡ Phân công lớp
                </button>
                <button
                  type="button"
                  onClick={() => setSqlViewMode('schema')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    sqlViewMode === 'schema'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  📄 Full Schema v2.0
                </button>
              </div>
            </div>

            {sqlViewMode === 'reset' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-[#E06D85]">Tệp: supabase/migration_single_school_year_reset.sql</span> (Thủ tục an toàn làm sạch năm cũ & bắt đầu năm mới)
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="/supabase/migration_single_school_year_reset.sql"
                      download="migration_single_school_year_reset.sql"
                      className="px-3 py-1.5 rounded-xl border border-rose-200 text-slate-700 hover:bg-rose-50 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải .SQL</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        fetch('/supabase/migration_single_school_year_reset.sql')
                          .then(r => r.text())
                          .then(code => {
                            navigator.clipboard.writeText(code);
                            setCopiedReset(true);
                            setTimeout(() => setCopiedReset(false), 2500);
                          })
                          .catch(() => {});
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#E06D85] hover:bg-[#C94C67] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      {copiedReset ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedReset ? 'Đã chép Reset SQL!' : 'Sao chép Reset SQL'}</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto">
                  <pre>{`-- MIGRATION: 20261102_single_school_year_reset.sql
-- NGUYÊN TẮC: MỖI LẦN CHỈ QUẢN LÝ MỘT NĂM HỌC HIỆN TẠI
-- 1. THỦ TỤC KẾT THÚC NĂM HỌC AN TOÀN CHO GIÁO VIÊN:
CREATE OR REPLACE FUNCTION public.reset_class_school_year(
    p_current_class_id TEXT,
    p_new_class_name TEXT,
    p_new_school_year TEXT,
    p_new_school_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
...`}</pre>
                </div>
              </div>
            ) : sqlViewMode === 'migration' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-emerald-700">Tệp: supabase/migration_class_management.sql</span> (An toàn, không DROP TABLE, bảo vệ phân công giáo viên)
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="/supabase/migration_class_management.sql"
                      download="migration_class_management.sql"
                      className="px-3 py-1.5 rounded-xl border border-rose-200 text-slate-700 hover:bg-rose-50 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải .SQL</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        fetch('/supabase/migration_class_management.sql')
                          .then(r => r.text())
                          .then(code => {
                            navigator.clipboard.writeText(code);
                            setCopiedMigration(true);
                            setTimeout(() => setCopiedMigration(false), 2500);
                          })
                          .catch(() => {});
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      {copiedMigration ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedMigration ? 'Đã chép Migration!' : 'Sao chép Migration SQL'}</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto">
                  <pre>{`-- MIGRATION: 20261102_class_management_and_teacher_assignments.sql
-- 1. KIỂM TRA KHÓA CHÍNH seating_layout TRƯỚC KHI ALTER TABLE
-- 2. BẢNG PHÂN CÔNG GIÁO VIÊN: teacher_assignments
-- 3. CHỐNG CHIẾM QUYỀN LỚP TRONG TRIGGER check_profile_role_update
-- 4. BẢNG TRẠNG THÁI gvcn_v2_state`}</pre>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Tệp: supabase/schema.sql</span> (Khởi tạo toàn diện 10 bảng cốt lõi)
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href="/supabase/schema.sql"
                      download="schema.sql"
                      className="px-3 py-1.5 rounded-xl border border-rose-200 text-slate-700 hover:bg-rose-50 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải .SQL</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        fetch('/supabase/schema.sql')
                          .then(r => r.text())
                          .then(code => {
                            navigator.clipboard.writeText(code);
                            setCopiedSql(true);
                            setTimeout(() => setCopiedSql(false), 2500);
                          })
                          .catch(() => {});
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSql ? 'Đã sao chép Schema!' : 'Sao chép Full Schema SQL'}</span>
                    </button>
                  </div>
                </div>

                <div className="bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto">
                  <pre>{`-- SUPABASE COMPLETE SCHEMA FOR PROJECT: thuy-trang
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 10 Bảng cốt lõi với khóa phức hợp (student_id, class_id):
-- profiles, class_settings, students, seating_layout, announcements,
-- honors, attendance, grades, conduct_logs, period_evaluations.`}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL KẾT THÚC NĂM HỌC – KHỞI TẠO NĂM HỌC MỚI ================= */}
      {showResetYearModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-rose-100 space-y-5 my-8">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-[#C94C67] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Kết thúc năm học – Khởi tạo năm học mới</h3>
                  <p className="text-xs text-slate-500">Mô hình quản lý duy nhất 1 năm học hiện tại</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetYearModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner if any */}
            {resetError && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            {/* Cảnh báo xóa dữ liệu cũ */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>CẢNH BÁO: CÁC DỮ LIỆU VẬN HÀNH NĂM CŨ SẼ ĐƯỢC LÀM MỚI</span>
              </div>
              <p className="leading-relaxed">
                Khi xác nhận khởi tạo năm học mới, toàn bộ dữ liệu của lớp thuộc năm học <strong>{settings.schoolYear}</strong> sẽ được <strong>XÓA SẠCH</strong> để chuẩn bị đón học sinh mới:
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-amber-800/90 font-medium">
                <li>Danh sách toàn bộ học sinh lớp cũ</li>
                <li>Toàn bộ điểm danh chuyên cần và bảng điểm các môn</li>
                <li>Nhật ký thi đua và kết quả xếp loại định kỳ</li>
                <li>Tất cả thông báo, bài vinh danh và sơ đồ chỗ ngồi của lớp</li>
              </ul>
              <div className="pt-2 border-t border-amber-200/80 font-semibold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Tài khoản giáo viên, mật khẩu đăng nhập, User UID trên Supabase và toàn bộ cấu hình quy tắc/môn học được GIỮ NGUYÊN 100%.</span>
              </div>
            </div>

            {/* Bước 1: Tải bản sao lưu */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Bước 1: Tải về bản sao lưu dữ liệu (.JSON) trước khi xóa</span>
                <span className="text-[11px] font-semibold text-[#E06D85]">Rất khuyến nghị</span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Hãy tải bản sao lưu về máy để lưu trữ sổ điểm và hồ sơ học sinh năm học cũ.
              </p>
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>Tải về file sao lưu năm học {settings.schoolYear} (.JSON)</span>
              </button>
            </div>

            {/* Bước 2: Nhập thông tin năm học mới */}
            <div className="space-y-3 text-xs">
              <div className="font-bold text-slate-800">Bước 2: Thiết lập thông tin năm học mới</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tên lớp mới *</label>
                  <input
                    type="text"
                    value={resetNewClassName}
                    onChange={e => setResetNewClassName(e.target.value)}
                    placeholder="VD: 11A1 hoặc 10A1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 font-bold text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Năm học mới *</label>
                  <input
                    type="text"
                    value={resetNewSchoolYear}
                    onChange={e => setResetNewSchoolYear(e.target.value)}
                    placeholder="VD: 2026 - 2027"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 font-bold text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Trường học</label>
                <input
                  type="text"
                  value={resetNewSchoolName}
                  onChange={e => setResetNewSchoolName(e.target.value)}
                  placeholder="VD: THPT Chuyên Lê Hồng Phong"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 font-semibold text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                />
              </div>
            </div>

            {/* Bước 3: Xác nhận lần cuối */}
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2 text-xs">
              <div className="font-bold text-rose-900">
                Bước 3: Xác nhận xóa dữ liệu cũ & khởi tạo năm học mới
              </div>
              <p className="text-slate-600 text-[11px]">
                Để bảo đảm an toàn và tránh thao tác nhầm lẫn, vui lòng nhập chính xác cụm từ <code className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-mono font-bold">KHOI TAO NAM HOC MOI</code> vào ô bên dưới:
              </p>
              <input
                type="text"
                value={resetConfirmText}
                onChange={e => setResetConfirmText(e.target.value)}
                placeholder="Nhập: KHOI TAO NAM HOC MOI"
                className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 font-mono font-bold text-rose-950 uppercase tracking-wider bg-white focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-rose-100">
              <button
                type="button"
                onClick={() => setShowResetYearModal(false)}
                disabled={isResettingYear}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleConfirmResetSchoolYear}
                disabled={isResettingYear || resetConfirmText.trim().toUpperCase() !== 'KHOI TAO NAM HOC MOI'}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600 text-white font-bold text-xs transition-all flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {isResettingYear ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang xóa dữ liệu & khởi tạo...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Xác nhận kết thúc & Khởi tạo năm học mới</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
