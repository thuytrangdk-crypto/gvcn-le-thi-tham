import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  Edit2,
  KeyRound,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  Calendar,
  Lock,
  Copy,
  Check,
  LayoutGrid,
  List,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import type { Student, Role, AttendanceRecord, ConductLog, AppSettings } from '../types';
import { excelService, studentApi, backupApi } from '../services/api';

interface StudentListViewProps {
  students: Student[];
  userRole: Role;
  attendance?: AttendanceRecord[];
  conductLogs?: ConductLog[];
  settings?: AppSettings;
  onOpenProfile: (studentId: string, initialTab?: string) => void;
  onCreateStudent: (data: Partial<Student>) => Promise<void>;
  onUpdateStudent: (id: string, data: Partial<Student>) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onImportStudents: (students: Partial<Student>[], mode?: 'append' | 'replace') => Promise<{
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    errors: Array<{ row: number; code?: string; name?: string; reason: string }>;
  }>;
  onResetPassword: (studentId: string) => Promise<string>;
  onCleanClass?: (confirmText: string) => Promise<{ success: boolean; message: string }>;
}

export const StudentListView: React.FC<StudentListViewProps> = ({
  students,
  userRole,
  attendance = [],
  conductLogs = [],
  settings = { className: '7A1', schoolYear: '2025 - 2026', baseConductScore: 100 } as any,
  onOpenProfile,
  onCreateStudent,
  onUpdateStudent,
  onDeleteStudent,
  onImportStudents,
  onResetPassword,
  onCleanClass
}) => {
  const isTeacher = userRole === 'teacher';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View Mode: 'card' (Dạng thẻ) or 'table' (Dạng bảng), persisted in localStorage
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gvcn_student_view_mode');
      return saved === 'table' ? 'table' : 'card';
    }
    return 'card';
  });

  const handleSetViewMode = (mode: 'card' | 'table') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gvcn_student_view_mode', mode);
    }
  };

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'Nam' | 'Nữ'>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [resettingStudent, setResettingStudent] = useState<Student | null>(null);
  const [resetSuccessPass, setResetSuccessPass] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Clean Class Modal
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleanConfirmText, setCleanConfirmText] = useState('');
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanError, setCleanError] = useState('');

  // Excel Import Preview Modal
  const [importPreviewRows, setImportPreviewRows] = useState<Partial<Student>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append'); // Mode B (default) or Mode A
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    errors: Array<{ row: number; code?: string; name?: string; reason: string }>;
  } | null>(null);

  // Add/Edit Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    gender: 'Nam' as 'Nam' | 'Nữ',
    dob: '',
    phone: '',
    address: '',
    parentName: '',
    parentPhone: '',
    notes: ''
  });
  const [formError, setFormError] = useState('');

  // Attendance map for today
  const todayStr = new Date().toISOString().substring(0, 10);
  const attendanceTodayMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord['status']>();
    attendance.filter(a => a.date === todayStr).forEach(a => {
      map.set(a.studentId, a.status);
    });
    return map;
  }, [attendance, todayStr]);

  // Violations & Merits map
  const studentConductStats = useMemo(() => {
    const map = new Map<string, { violations: number; merits: number; score: number }>();
    const baseScore = settings.baseConductScore || 100;

    students.forEach(s => {
      map.set(s.id, { violations: 0, merits: 0, score: baseScore });
    });

    conductLogs.forEach(l => {
      const cur = map.get(l.studentId) || { violations: 0, merits: 0, score: baseScore };
      cur.score += l.points;
      if (l.points < 0) {
        cur.violations += 1;
      } else if (l.points > 0) {
        cur.merits += 1;
      }
      map.set(l.studentId, cur);
    });

    return map;
  }, [students, conductLogs, settings.baseConductScore]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.phone && s.phone.includes(searchTerm));
      const matchGender = genderFilter === 'ALL' || s.gender === genderFilter;
      return matchSearch && matchGender;
    });
  }, [students, searchTerm, genderFilter]);

  const handleOpenAdd = () => {
    setFormData({
      code: `HS${String(students.length + 1).padStart(2, '0')}`,
      name: '',
      gender: 'Nam',
      dob: '15/05/2009',
      phone: '',
      address: '',
      parentName: '',
      parentPhone: '',
      notes: ''
    });
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      code: student.code,
      name: student.name,
      gender: student.gender,
      dob: student.dob,
      phone: student.phone || '',
      address: student.address || '',
      parentName: student.parentName || '',
      parentPhone: student.parentPhone || '',
      notes: student.notes || ''
    });
    setFormError('');
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim() || !formData.dob.trim()) {
      setFormError('Vui lòng điền đủ Mã học sinh, Họ và tên và Ngày sinh');
      return;
    }

    try {
      if (editingStudent) {
        await onUpdateStudent(editingStudent.id, formData);
        setEditingStudent(null);
      } else {
        await onCreateStudent(formData);
        setShowAddModal(false);
      }
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu thông tin');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { rows, errors } = await excelService.parseStudentFile(file);
      setImportPreviewRows(rows);
      setImportErrors(errors);
      setImportResult(null);
      setImportMode('append'); // default to safe append
      setShowImportModal(true);
    } catch (err: any) {
      alert(`Không thể đọc file Excel: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (importPreviewRows.length === 0) return;
    if (importMode === 'replace') {
      const ok = confirm(
        'CẢNH BÁO: Chế độ "Thay thế toàn bộ danh sách lớp" sẽ xóa toàn bộ học sinh hiện có cùng điểm danh, điểm số và thi đua liên quan.\n\nBạn có chắc chắn muốn thực hiện?'
      );
      if (!ok) return;
    }

    setIsImporting(true);
    try {
      const res = await onImportStudents(importPreviewRows, importMode);
      setImportResult(res);
      setImportPreviewRows([]);
    } catch (err: any) {
      alert(`Lỗi import: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetPasswordClick = async (student: Student) => {
    setResettingStudent(student);
    try {
      const defaultPass = await onResetPassword(student.id);
      setResetSuccessPass(defaultPass);
    } catch (err: any) {
      alert(err.message);
      setResettingStudent(null);
    }
  };

  const handleCopyPassword = () => {
    if (resetSuccessPass) {
      navigator.clipboard.writeText(resetSuccessPass);
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  const handleConfirmCleanClass = async () => {
    if (cleanConfirmText.trim().toUpperCase() !== 'LAM SACH LOP') {
      setCleanError('Vui lòng nhập chính xác cụm từ "LAM SACH LOP"');
      return;
    }

    setIsCleaning(true);
    setCleanError('');
    try {
      if (onCleanClass) {
        await onCleanClass(cleanConfirmText);
      } else {
        await studentApi.cleanClass(cleanConfirmText);
      }
      setShowCleanModal(false);
      setCleanConfirmText('');
      window.location.reload();
    } catch (err: any) {
      setCleanError(err.message || 'Lỗi khi làm sạch dữ liệu lớp');
    } finally {
      setIsCleaning(false);
    }
  };

  // Helper for initial letter
  const getInitial = (name: string) => {
    const parts = name.trim().split(' ');
    const lastWord = parts[parts.length - 1] || 'H';
    return lastWord.charAt(0).toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* 1. Action Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-rose-100 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Left: Search & Gender filter & View Mode Toggle */}
        <div className="flex flex-1 items-center gap-3 flex-wrap sm:flex-nowrap">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm theo họ tên, mã học sinh, SĐT..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#E06D85] focus:bg-white transition-all"
            />
          </div>

          {/* Gender Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl shrink-0">
            <button
              onClick={() => setGenderFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                genderFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tất cả ({students.length})
            </button>
            <button
              onClick={() => setGenderFilter('Nam')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                genderFilter === 'Nam' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-blue-700'
              }`}
            >
              Nam
            </button>
            <button
              onClick={() => setGenderFilter('Nữ')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                genderFilter === 'Nữ' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-rose-700'
              }`}
            >
              Nữ
            </button>
          </div>

          {/* View Mode Toggle: Grid Card vs Table */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl shrink-0">
            <button
              onClick={() => handleSetViewMode('card')}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'card'
                  ? 'bg-white text-[#C94C67] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Chế độ hiển thị dạng thẻ học sinh"
            >
              <LayoutGrid className="w-4 h-4 text-[#E06D85]" />
              <span className="hidden sm:inline">Dạng thẻ</span>
            </button>
            <button
              onClick={() => handleSetViewMode('table')}
              className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-white text-[#C94C67] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Chế độ hiển thị bảng danh sách đầy đủ"
            >
              <List className="w-4 h-4 text-[#E06D85]" />
              <span className="hidden sm:inline">Dạng bảng</span>
            </button>
          </div>
        </div>

        {/* Right: Action Buttons for Teacher */}
        {isTeacher && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Export Excel (Student List) */}
            <button
              type="button"
              onClick={() => excelService.exportStudents(students)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Xuất toàn bộ danh sách học sinh lớp ra file Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Xuất Excel</span>
            </button>

            {/* Export Conduct Report */}
            <button
              type="button"
              onClick={() => excelService.exportConductReport(students, conductLogs, settings)}
              className="px-3 py-2 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Xuất báo cáo tổng hợp thi đua, nề nếp và xếp loại học sinh ra Excel"
            >
              <Download className="w-4 h-4 text-purple-600" />
              <span>Xuất Excel thi đua</span>
            </button>

            {/* Import Excel */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-2xl border border-emerald-200 text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Nhập danh sách học sinh từ file Excel"
            >
              <Upload className="w-4 h-4 text-emerald-700" />
              <span>Nhập Excel</span>
            </button>

            {/* Add Student */}
            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-2xl bg-[#E06D85] text-white text-xs font-extrabold hover:bg-[#C94C67] flex items-center gap-1.5 transition-all shadow-md shadow-rose-200/60"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm học sinh</span>
            </button>

            {/* Clean Class Data (Làm sạch lớp) */}
            <button
              type="button"
              onClick={() => {
                setCleanConfirmText('');
                setCleanError('');
                setShowCleanModal(true);
              }}
              className="px-3 py-2 rounded-2xl border border-rose-200 text-rose-700 bg-rose-50/60 hover:bg-rose-100 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs ml-auto sm:ml-0"
              title="Làm sạch danh sách học sinh và dữ liệu lớp (chỉ khi cần dọn dữ liệu chuẩn bị nạp mới)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              <span>Làm sạch lớp</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. CHẾ ĐỘ HIỂN THỊ DẠNG THẺ (CARD VIEW - 8A3 Style) */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStudents.map(st => {
            const todayStatus = attendanceTodayMap.get(st.id);
            const stats = studentConductStats.get(st.id) || { violations: 0, merits: 0, score: 100 };
            const isFemale = st.gender === 'Nữ';

            return (
              <div
                key={st.id}
                className="bg-white rounded-3xl p-5 border border-rose-100/90 shadow-xs hover:shadow-md hover:border-rose-300 transition-all flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top of Card: Avatar + Gender + Actions */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-extrabold text-base shadow-2xs shrink-0 ${
                          isFemale
                            ? 'bg-rose-50 text-rose-600 border border-rose-100'
                            : 'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}
                      >
                        {getInitial(st.name)}
                      </div>
                      <div className="min-w-0">
                        <span className="font-mono text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          {st.code}
                        </span>
                        <h4
                          onClick={() => onOpenProfile(st.id)}
                          className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-rose-700 transition-colors truncate cursor-pointer leading-tight mt-0.5"
                          title={st.name}
                        >
                          {st.name}
                        </h4>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase shrink-0 ${
                        isFemale
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                      }`}
                    >
                      {st.gender}
                    </span>
                  </div>

                  {/* Student Details */}
                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[11px]">Ngày sinh:</span>
                      <span className="font-mono font-semibold text-slate-700 tabular-nums">{st.dob}</span>
                    </div>

                    {st.phone && (
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="text-[11px]">Điện thoại:</span>
                        <span className="font-mono text-slate-700">{st.phone}</span>
                      </div>
                    )}

                    {/* Attendance status badge */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">Điểm danh:</span>
                      {todayStatus === 'present' ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold">
                          Có mặt
                        </span>
                      ) : todayStatus === 'late' ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 text-[10px] font-bold">
                          Đi học muộn
                        </span>
                      ) : todayStatus === 'excused_absence' ? (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60 text-[10px] font-bold">
                          Nghỉ có phép
                        </span>
                      ) : todayStatus === 'unexcused_absence' ? (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60 text-[10px] font-bold">
                          Vắng không phép
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-medium">
                          Chưa ĐD
                        </span>
                      )}
                    </div>

                    {/* Conduct stats pills */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">Thi đua:</span>
                      <div className="flex items-center gap-1.5">
                        {stats.violations > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-bold">
                            Vi phạm: {stats.violations}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">
                            Tốt ({stats.score}đ)
                          </span>
                        )}
                        {stats.merits > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold">
                            +{stats.merits}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Action Buttons */}
                <div className="mt-4 pt-3 border-t border-rose-50 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenProfile(st.id)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100/80 text-[#C94C67] text-xs font-bold transition-colors flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem hồ sơ</span>
                  </button>

                  {isTeacher && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleResetPasswordClick(st)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                        title="Đặt lại mật khẩu mặc định (MSDDMMYYYY)"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(st)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        title="Chỉnh sửa thông tin học sinh"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Bạn chắc chắn muốn xóa học sinh "${st.name}" (${st.code})? Dữ liệu liên quan sẽ bị xóa.`)) {
                            onDeleteStudent(st.id);
                          }
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                        title="Xóa học sinh này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredStudents.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-rose-100 p-8">
              <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Không tìm thấy học sinh nào</p>
              <p className="text-xs text-slate-400 mt-1">Hãy kiểm tra lại từ khóa tìm kiếm hoặc bộ lọc giới tính.</p>
            </div>
          )}
        </div>
      )}

      {/* 3. CHẾ ĐỘ HIỂN THỊ DẠNG BẢNG (TABLE VIEW) */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FFF8F9] border-b border-rose-100 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">STT</th>
                  <th className="py-3 px-4 w-28">Mã HS</th>
                  <th className="py-3 px-4">Họ và tên</th>
                  <th className="py-3 px-4 w-24">Giới tính</th>
                  <th className="py-3 px-4 w-32">Ngày sinh</th>
                  <th className="py-3 px-4 w-36">Điện thoại</th>
                  <th className="py-3 px-4">Địa chỉ / Phụ huynh</th>
                  <th className="py-3 px-4 text-right w-44">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50 text-slate-700">
                {filteredStudents.map((st, index) => (
                  <tr
                    key={st.id}
                    className="hover:bg-rose-50/30 transition-colors group"
                  >
                    <td className="py-3 px-4 text-center font-mono text-slate-400 tabular-nums">
                      {index + 1}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {st.code}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onOpenProfile(st.id)}
                        className="font-bold text-slate-900 hover:text-rose-700 transition-colors text-left flex items-center gap-2"
                      >
                        <span>{st.name}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block font-semibold ${
                        st.gender === 'Nam' ? 'text-blue-600' : 'text-rose-600'
                      }`}>
                        {st.gender}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {st.dob}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                      {st.phone || <span className="text-slate-300 italic">Chưa có</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-500 truncate max-w-xs">
                      {st.address || st.parentName || <span className="text-slate-300 italic">--</span>}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <button
                        onClick={() => onOpenProfile(st.id)}
                        className="px-2.5 py-1 rounded-xl bg-rose-50 text-[#C94C67] hover:bg-rose-100 font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                        title="Xem hồ sơ học sinh"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Hồ sơ</span>
                      </button>

                      {isTeacher && (
                        <>
                          <button
                            onClick={() => handleResetPasswordClick(st)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-amber-700 hover:bg-amber-50"
                            title="Đặt lại mật khẩu mặc định (MSDDMMYYYY)"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(st)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-blue-700 hover:bg-blue-50"
                            title="Sửa thông tin"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Bạn chắc chắn muốn xóa học sinh "${st.name}" (${st.code})? Dữ liệu liên quan sẽ được xóa.`)) {
                                onDeleteStudent(st.id);
                              }
                            }}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-red-700 hover:bg-red-50"
                            title="Xóa học sinh"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Không tìm thấy học sinh nào phù hợp với bộ lọc tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. MODAL: NHẬP DANH SÁCH HỌC SINH TỪ EXCEL (Chuẩn 8A3) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-rose-100 space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-2xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    NHẬP DANH SÁCH HỌC SINH TỪ EXCEL
                  </h3>
                  <p className="text-xs text-slate-400">
                    Kiểm tra thông tin trước khi xác nhận lưu vào hệ thống
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions & Template download */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100 text-xs">
              <div className="text-slate-600">
                <span>Hỗ trợ tệp <strong>.xlsx, .xls</strong>. Hãy đảm bảo file có đầy đủ các cột Mã HS, Họ và tên, Giới tính, Ngày sinh.</span>
              </div>
              <button
                type="button"
                onClick={excelService.downloadStudentTemplate}
                className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-[#C94C67] font-bold text-xs hover:bg-rose-50 flex items-center gap-1.5 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải file mẫu Excel</span>
              </button>
            </div>

            {/* Chế độ nhập (Mode Selection: Mode B - Thêm bổ sung [default] vs Mode A - Thay thế toàn bộ) */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Chọn phương thức nhập dữ liệu:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    importMode === 'append'
                      ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-extrabold text-slate-800">
                      Chế độ B – Thêm bổ sung (Khuyên dùng)
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      Giữ nguyên học sinh cũ. Chỉ bổ sung những học sinh mới chưa tồn tại, tự động kiểm tra và bỏ qua trùng lặp.
                    </div>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                    importMode === 'replace'
                      ? 'bg-rose-50/70 border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-extrabold text-rose-800">
                      Chế độ A – Thay thế toàn bộ danh sách lớp
                    </div>
                    <div className="text-[11px] text-rose-700/80 mt-0.5 leading-relaxed">
                      Xóa toàn bộ học sinh hiện tại và nhập mới. Dữ liệu điểm danh, điểm số cũ của lớp sẽ được làm mới.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Error alerts from file reading */}
            {importErrors.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Cảnh báo định dạng file ({importErrors.length} lưu ý):</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 max-h-24 overflow-y-auto">
                  {importErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Import result summary */}
            {importResult && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-2">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Kết quả xử lý: Thành công {importResult.successCount} / {importResult.totalProcessed} dòng</span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 text-rose-700">
                    <p className="font-semibold">Có {importResult.errors.length} dòng không thể nhập do trùng hoặc lỗi:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                      {importResult.errors.map((e, i) => (
                        <li key={i}>Dòng {e.row}: {e.reason} ({e.name || e.code})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Preview table */}
            {importPreviewRows.length > 0 && (
              <div className="flex-1 overflow-y-auto border border-rose-100 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FFF8F9] sticky top-0 border-b border-rose-100 text-slate-600 font-bold">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">STT</th>
                      <th className="py-2.5 px-3 w-28">Mã HS</th>
                      <th className="py-2.5 px-3">Họ và tên</th>
                      <th className="py-2.5 px-3 w-24">Giới tính</th>
                      <th className="py-2.5 px-3 w-28">Ngày sinh</th>
                      <th className="py-2.5 px-3 w-32">Số điện thoại</th>
                      <th className="py-2.5 px-3">Địa chỉ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50 text-slate-700">
                    {importPreviewRows.map((r, i) => (
                      <tr key={i} className="hover:bg-rose-50/20">
                        <td className="py-2 px-3 font-mono text-slate-400 text-center">{i + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{r.code}</td>
                        <td className="py-2 px-3 font-semibold">{r.name}</td>
                        <td className="py-2 px-3">{r.gender}</td>
                        <td className="py-2 px-3 font-mono">{r.dob}</td>
                        <td className="py-2 px-3 font-mono">{r.phone || '--'}</td>
                        <td className="py-2 px-3 truncate max-w-xs">{r.address || '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-3 border-t border-rose-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {importPreviewRows.length > 0 ? `Sẵn sàng nạp ${importPreviewRows.length} học sinh (${importMode === 'replace' ? 'Chế độ thay thế' : 'Chế độ bổ sung'})` : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-2xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  Đóng
                </button>
                {importPreviewRows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="px-5 py-2 rounded-2xl bg-[#E06D85] hover:bg-[#C94C67] text-white text-xs font-bold transition-all shadow-md shadow-rose-200/60 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isImporting ? 'Đang xử lý...' : 'Xác nhận nhập vào lớp'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: LÀM SẠCH LỚP (Clean Class Data) */}
      {showCleanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-extrabold text-slate-900 text-base">
                  LÀM SẠCH DỮ LIỆU LỚP
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lớp {settings.className || '7A1'} — Năm học {settings.schoolYear || '2025 - 2026'}
                </p>
              </div>
              <button
                onClick={() => setShowCleanModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Thao tác này sẽ xóa các dữ liệu sau của lớp hiện tại:</span>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>Toàn bộ {students.length} học sinh trong danh sách</li>
                <li>Dữ liệu điểm danh, điểm kiểm tra học tập và thi đua của các học sinh này</li>
                <li>Sắp xếp sơ đồ chỗ ngồi của lớp</li>
              </ul>
              <p className="text-emerald-700 font-semibold pt-1 border-t border-amber-200/60">
                ✓ Cài đặt tên trường, tên lớp, năm học và tài khoản giáo viên được giữ nguyên.
              </p>
            </div>

            {/* Backup button */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-600 font-medium">Bạn nên sao lưu dữ liệu trước khi xóa:</span>
              <button
                type="button"
                onClick={() => excelService.exportStudents(students)}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 font-bold text-xs hover:bg-slate-100 flex items-center gap-1 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tải bản sao lưu Excel</span>
              </button>
            </div>

            {cleanError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{cleanError}</span>
              </div>
            )}

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-slate-700">
                Nhập chính xác cụm từ <span className="text-rose-600 select-all font-mono">LAM SACH LOP</span> để xác nhận:
              </label>
              <input
                type="text"
                value={cleanConfirmText}
                onChange={e => setCleanConfirmText(e.target.value)}
                placeholder="LAM SACH LOP"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-rose-300 font-mono text-sm text-slate-900 uppercase focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="pt-2 border-t border-rose-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCleanModal(false)}
                className="px-4 py-2 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={cleanConfirmText.trim().toUpperCase() !== 'LAM SACH LOP' || isCleaning}
                onClick={handleConfirmCleanClass}
                className="px-5 py-2 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold transition-all shadow-md shadow-red-200 disabled:opacity-40"
              >
                {isCleaning ? 'Đang xóa...' : 'Đồng ý làm sạch lớp'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: THÊM / SỬA HỌC SINH */}
      {(showAddModal || editingStudent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rose-100 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <h3 className="font-extrabold text-slate-800 text-base">
                {editingStudent ? `Sửa thông tin: ${editingStudent.name}` : 'Thêm học sinh mới'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingStudent(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-2xl bg-red-50 text-red-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Mã học sinh *
                  </label>
                  <input
                    type="text"
                    disabled={!!editingStudent}
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="VD: HS31"
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 uppercase focus:ring-2 focus:ring-[#E06D85] disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Giới tính *
                  </label>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData({ ...formData, gender: e.target.value as 'Nam' | 'Nữ' })}
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ngày sinh (DD/MM/YYYY) *
                  </label>
                  <input
                    type="text"
                    value={formData.dob}
                    onChange={e => setFormData({ ...formData, dob: e.target.value })}
                    placeholder="15/05/2009"
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0912345678"
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Địa chỉ thường trú
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Số nhà, đường, phường/xã..."
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Họ tên phụ huynh
                  </label>
                  <input
                    type="text"
                    value={formData.parentName}
                    onChange={e => setFormData({ ...formData, parentName: e.target.value })}
                    placeholder="Ông/Bà..."
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    SĐT phụ huynh
                  </label>
                  <input
                    type="text"
                    value={formData.parentPhone}
                    onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                    placeholder="0903123456"
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ghi chú
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ghi chú thêm về học sinh..."
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
                />
              </div>

              <div className="pt-3 border-t border-rose-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingStudent(null);
                  }}
                  className="px-4 py-2 rounded-2xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-2xl bg-[#E06D85] text-white font-extrabold hover:bg-[#C94C67] shadow-xs"
                >
                  {editingStudent ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: ĐẶT LẠI MẬT KHẨU HỌC SINH */}
      {resettingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">Đặt lại mật khẩu học sinh</h4>
                <p className="text-xs text-slate-400">{resettingStudent.name} ({resettingStudent.code})</p>
              </div>
            </div>

            {resetSuccessPass ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đặt lại thành công!</span>
                  </div>
                  <p>Mật khẩu khởi tạo chuẩn theo định dạng MSDDMMYYYY:</p>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-emerald-200 font-mono text-sm font-bold text-emerald-950 mt-1">
                    <span>{resetSuccessPass}</span>
                    <button
                      onClick={handleCopyPassword}
                      className="p-1 text-slate-500 hover:text-emerald-700"
                      title="Sao chép mật khẩu"
                    >
                      {copiedPass ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setResettingStudent(null);
                    setResetSuccessPass(null);
                  }}
                  className="w-full py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600">
                <p>
                  Hệ thống sẽ đặt lại mật khẩu cho học sinh này về mặc định gồm <strong>Mã học sinh</strong> kết hợp cùng <strong>Ngày tháng năm sinh</strong> (Định dạng MSDDMMYYYY).
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setResettingStudent(null)}
                    className="px-4 py-2 rounded-2xl border border-slate-200 font-semibold"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
