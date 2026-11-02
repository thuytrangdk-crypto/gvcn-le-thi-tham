import React, { useState, useMemo, useRef } from 'react';
import {
  BookOpen,
  Download,
  Upload,
  FileSpreadsheet,
  Plus,
  Trash2,
  Edit2,
  Filter,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import type { Student, GradeRecord, AppSettings, UserSession, AssessmentType } from '../types';
import { gradeApi, excelService } from '../services/api';

interface AcademicsViewProps {
  students: Student[];
  grades: GradeRecord[];
  settings: AppSettings;
  user: UserSession | null;
  onRefreshData: () => Promise<void>;
  onOpenStudentProfile: (studentId: string, tab?: string) => void;
}

export const AcademicsView: React.FC<AcademicsViewProps> = ({
  students,
  grades,
  settings,
  user,
  onRefreshData,
  onOpenStudentProfile
}) => {
  const isTeacher = user?.role === 'teacher';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [selectedSemester, setSelectedSemester] = useState<'ALL' | 'HK1' | 'HK2'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Add Grade Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingGrade, setEditingGrade] = useState<GradeRecord | null>(null);
  const [formData, setFormData] = useState<{
    studentId: string;
    subjectId: string;
    semester: 'HK1' | 'HK2';
    assessmentType: AssessmentType;
    score: string;
    qualitativeRating: string;
    note: string;
    date: string;
  }>({
    studentId: '',
    subjectId: settings.subjects[0]?.id || '',
    semester: 'HK1',
    assessmentType: 'TX1',
    score: '',
    qualitativeRating: 'Đạt',
    note: '',
    date: new Date().toISOString().substring(0, 10)
  });
  const [formError, setFormError] = useState<string>('');

  // Import state
  const [importModal, setImportModal] = useState<boolean>(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  // Student map
  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students]);
  const subjectMap = useMemo(() => new Map(settings.subjects.map(sub => [sub.id, sub])), [settings.subjects]);

  // Filtered grades
  const filteredGrades = useMemo(() => {
    return grades.filter(g => {
      const matchSubject = selectedSubjectId === 'ALL' || g.subjectId === selectedSubjectId;
      const matchSemester = selectedSemester === 'ALL' || g.semester === selectedSemester;
      const st = studentMap.get(g.studentId);
      const matchSearch =
        !searchTerm ||
        st?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        st?.code.toLowerCase().includes(searchTerm.toLowerCase());
      return matchSubject && matchSemester && matchSearch;
    });
  }, [grades, selectedSubjectId, selectedSemester, searchTerm, studentMap]);

  // Selected subject config
  const currentSubject = settings.subjects.find(s => s.id === formData.subjectId);

  const handleOpenAdd = () => {
    setFormData({
      studentId: students[0]?.id || '',
      subjectId: settings.subjects[0]?.id || '',
      semester: 'HK1',
      assessmentType: 'TX1',
      score: '',
      qualitativeRating: 'Đạt',
      note: '',
      date: new Date().toISOString().substring(0, 10)
    });
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (grade: GradeRecord) => {
    setEditingGrade(grade);
    setFormData({
      studentId: grade.studentId,
      subjectId: grade.subjectId,
      semester: grade.semester,
      assessmentType: grade.assessmentType,
      score: grade.score !== undefined ? String(grade.score) : '',
      qualitativeRating: grade.qualitativeRating || 'Đạt',
      note: grade.note || '',
      date: grade.date
    });
    setFormError('');
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.subjectId) {
      setFormError('Vui lòng chọn học sinh và môn học');
      return;
    }

    const sub = subjectMap.get(formData.subjectId);
    let parsedScore: number | undefined = undefined;
    let qual: string | undefined = undefined;

    if (sub?.type === 'score') {
      if (formData.score === '') {
        setFormError('Vui lòng nhập điểm số hợp lệ từ 0 đến 10');
        return;
      }
      const num = Number(formData.score);
      if (isNaN(num) || num < 0 || num > 10) {
        setFormError('Điểm số phải nằm trong khoảng từ 0.0 đến 10.0');
        return;
      }
      parsedScore = num;
    } else {
      qual = formData.qualitativeRating;
    }

    try {
      if (editingGrade) {
        await gradeApi.update(editingGrade.id, {
          semester: formData.semester,
          assessmentType: formData.assessmentType,
          score: parsedScore,
          qualitativeRating: qual as any,
          note: formData.note,
          date: formData.date
        });
        setEditingGrade(null);
      } else {
        await gradeApi.create({
          studentId: formData.studentId,
          subjectId: formData.subjectId,
          semester: formData.semester,
          assessmentType: formData.assessmentType,
          score: parsedScore,
          qualitativeRating: qual as any,
          note: formData.note,
          date: formData.date
        });
        setShowAddModal(false);
      }
      await onRefreshData();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu điểm');
    }
  };

  const handleDeleteGrade = async (grade: GradeRecord) => {
    const st = studentMap.get(grade.studentId);
    const sub = subjectMap.get(grade.subjectId);
    if (!confirm(`Bạn chắc chắn muốn xóa điểm ${grade.assessmentType} môn ${sub?.name} của học sinh ${st?.name}?`)) {
      return;
    }
    try {
      await gradeApi.delete(grade.id);
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa điểm');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { rows, errors } = await excelService.parseGradeFile(file);
      setImportRows(rows);
      setImportErrors(errors);
      setImportResult(null);
      setImportModal(true);
    } catch (err: any) {
      alert(`Lỗi đọc file: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (importRows.length === 0) return;
    setIsImporting(true);
    try {
      const res = await gradeApi.import(importRows);
      setImportResult(res);
      setImportRows([]);
      await onRefreshData();
    } catch (err: any) {
      alert(`Lỗi khi nhập điểm: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Actions */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-rose-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-800 text-lg sm:text-xl flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#E06D85]" />
            <span>Sổ theo dõi học tập & Bảng điểm</span>
          </h2>
          <p className="text-xs text-slate-400">
            Quản lý điểm số, kiểm tra thường xuyên, giữa kỳ, cuối kỳ theo từng môn học
          </p>
        </div>

        {isTeacher && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleFileUpload}
            />

            <button
              onClick={() => excelService.downloadGradeTemplate(students, settings.subjects)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
              title="Tải bảng điểm mẫu chuẩn"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Tải file mẫu Excel</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl border border-emerald-200 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5"
              title="Nhập bảng điểm từ Excel"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-700" />
              <span>Nhập điểm Excel</span>
            </button>

            <button
              onClick={() => excelService.exportGrades(grades, students, settings.subjects)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5"
              title="Xuất bảng điểm lớp ra Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              <span>Xuất Excel</span>
            </button>

            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-2 rounded-xl bg-[#E06D85] text-white text-xs font-bold hover:bg-[#C94C67] flex items-center gap-1.5 shadow-xs shadow-rose-200"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm điểm</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-rose-100 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Subject Filter */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Môn học:</span>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-rose-100 bg-rose-50/40 text-slate-800 font-semibold outline-hidden"
            >
              <option value="ALL">-- Tất cả môn học --</option>
              {settings.subjects.filter(s => s.isActive).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Học kỳ:</span>
            <select
              value={selectedSemester}
              onChange={e => setSelectedSemester(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-rose-100 bg-rose-50/40 text-slate-800 font-semibold outline-hidden"
            >
              <option value="ALL">Cả năm</option>
              <option value="HK1">Học kỳ 1</option>
              <option value="HK2">Học kỳ 2</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Tìm học sinh theo tên, mã HS..."
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs w-60"
        />
      </div>

      {/* Grade Table */}
      <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FFF8F9] border-b border-rose-100 text-slate-500 font-bold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4 w-12 text-center">STT</th>
                <th className="py-3 px-4 w-28">Mã HS</th>
                <th className="py-3 px-4">Họ và tên</th>
                <th className="py-3 px-4">Môn học</th>
                <th className="py-3 px-4">Học kỳ</th>
                <th className="py-3 px-4">Loại kiểm tra</th>
                <th className="py-3 px-4 text-center">Điểm số / Đánh giá</th>
                <th className="py-3 px-4">Ngày đánh giá</th>
                <th className="py-3 px-4">Ghi chú</th>
                {isTeacher && <th className="py-3 px-4 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50 text-slate-700">
              {filteredGrades.map((g, idx) => {
                const st = studentMap.get(g.studentId);
                const sub = subjectMap.get(g.subjectId);
                return (
                  <tr key={g.id} className="hover:bg-rose-50/20">
                    <td className="py-2.5 px-4 text-center font-mono text-slate-400 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                      {st?.code || g.studentId}
                    </td>
                    <td className="py-2.5 px-4">
                      <button
                        onClick={() => onOpenStudentProfile(g.studentId, 'academics')}
                        className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-left"
                      >
                        {st?.name || 'Học sinh'}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      {sub?.name || g.subjectId}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-600">
                      {g.semester}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">
                      {g.assessmentType}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-bold text-sm">
                      {g.score !== undefined ? (
                        <span className="text-blue-700 tabular-nums">{g.score}</span>
                      ) : (
                        <span className="text-emerald-700 font-sans font-bold">{g.qualitativeRating || 'Đạt'}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums">
                      {g.date}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 truncate max-w-xs">
                      {g.note || '--'}
                    </td>
                    {isTeacher && (
                      <td className="py-2.5 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEdit(g)}
                          className="p-1 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50"
                          title="Sửa điểm"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteGrade(g)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50"
                          title="Xóa điểm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredGrades.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Không tìm thấy bản ghi điểm nào theo điều kiện lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Grade Modal */}
      {(showAddModal || editingGrade) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <h4 className="font-bold text-slate-800 text-sm">
                {editingGrade ? 'Chỉnh sửa điểm đánh giá' : 'Nhập điểm học tập mới'}
              </h4>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingGrade(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveGrade} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Học sinh *
                </label>
                <select
                  disabled={!!editingGrade}
                  value={formData.studentId}
                  onChange={e => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 font-semibold disabled:bg-slate-100"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Môn học *
                  </label>
                  <select
                    disabled={!!editingGrade}
                    value={formData.subjectId}
                    onChange={e => setFormData({ ...formData, subjectId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 font-semibold disabled:bg-slate-100"
                  >
                    {settings.subjects.filter(s => s.isActive).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Học kỳ *
                  </label>
                  <select
                    value={formData.semester}
                    onChange={e => setFormData({ ...formData, semester: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 font-semibold"
                  >
                    <option value="HK1">Học kỳ 1</option>
                    <option value="HK2">Học kỳ 2</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Loại kiểm tra *
                  </label>
                  <select
                    value={formData.assessmentType}
                    onChange={e => setFormData({ ...formData, assessmentType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 font-mono"
                  >
                    <option value="TX1">Thường xuyên 1 (TX1)</option>
                    <option value="TX2">Thường xuyên 2 (TX2)</option>
                    <option value="TX3">Thường xuyên 3 (TX3)</option>
                    <option value="GK">Giữa kỳ (GK)</option>
                    <option value="CK">Cuối kỳ (CK)</option>
                  </select>
                </div>

                <div>
                  {currentSubject?.type === 'score' ? (
                    <div>
                      <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Điểm số (0 - 10) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={formData.score}
                        onChange={e => setFormData({ ...formData, score: e.target.value })}
                        placeholder="VD: 8.5"
                        className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 font-mono font-bold"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Đánh giá nhận xét *
                      </label>
                      <select
                        value={formData.qualitativeRating}
                        onChange={e => setFormData({ ...formData, qualitativeRating: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 font-semibold"
                      >
                        <option value="Đạt">Đạt</option>
                        <option value="Chưa đạt">Chưa đạt</option>
                        <option value="Hoàn thành tốt">Hoàn thành tốt</option>
                        <option value="Hoàn thành">Hoàn thành</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ngày đánh giá
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Ghi chú
                </label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Kiểm tra miệng, thuyết trình..."
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-rose-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingGrade(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#E06D85] text-white font-bold hover:bg-[#C94C67]"
                >
                  {editingGrade ? 'Cập nhật' : 'Lưu điểm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-rose-100 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <h4 className="font-bold text-slate-800 text-base">Xem trước dữ liệu bảng điểm Excel</h4>
              <button onClick={() => setImportModal(false)} className="p-1.5 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {importErrors.length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 text-amber-800 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Có {importErrors.length} cảnh báo:</span>
                </div>
                <ul className="list-disc pl-5 max-h-20 overflow-y-auto">
                  {importErrors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}

            {importResult && (
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Đã nhập thành công {importResult.successCount} / {importResult.total} bản ghi!</span>
                </div>
              </div>
            )}

            {importRows.length > 0 && (
              <div className="flex-1 overflow-y-auto border border-rose-100 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 sticky top-0 border-b border-rose-100 font-bold text-slate-500">
                    <tr>
                      <th className="py-2 px-3">Mã HS</th>
                      <th className="py-2 px-3">Môn</th>
                      <th className="py-2 px-3">Học kỳ</th>
                      <th className="py-2 px-3">Loại</th>
                      <th className="py-2 px-3">Điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50 text-slate-700">
                    {importRows.map((r, i) => (
                      <tr key={i}>
                        <td className="py-1.5 px-3 font-mono font-bold">{r.studentCode}</td>
                        <td className="py-1.5 px-3">{r.subjectName || r.subjectCode}</td>
                        <td className="py-1.5 px-3">{r.semester}</td>
                        <td className="py-1.5 px-3 font-mono">{r.assessmentType}</td>
                        <td className="py-1.5 px-3 font-mono font-bold text-blue-700">
                          {r.score !== undefined ? r.score : r.qualitativeRating}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-3 border-t border-rose-100 flex justify-end gap-2">
              <button
                onClick={() => setImportModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold"
              >
                Đóng
              </button>
              {importRows.length > 0 && (
                <button
                  onClick={handleConfirmImport}
                  disabled={isImporting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  {isImporting ? 'Đang lưu...' : 'Lưu bảng điểm vào hệ thống'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
