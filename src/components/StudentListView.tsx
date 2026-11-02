import React, { useState, useMemo, useRef } from 'react';
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
  Filter,
  User,
  Phone,
  Calendar,
  Lock,
  Copy,
  Check
} from 'lucide-react';
import type { Student, Role } from '../types';
import { excelService } from '../services/api';

interface StudentListViewProps {
  students: Student[];
  userRole: Role;
  onOpenProfile: (studentId: string, initialTab?: string) => void;
  onCreateStudent: (data: Partial<Student>) => Promise<void>;
  onUpdateStudent: (id: string, data: Partial<Student>) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onImportStudents: (students: Partial<Student>[]) => Promise<{
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    errors: Array<{ row: number; code?: string; name?: string; reason: string }>;
  }>;
  onResetPassword: (studentId: string) => Promise<string>;
}

export const StudentListView: React.FC<StudentListViewProps> = ({
  students,
  userRole,
  onOpenProfile,
  onCreateStudent,
  onUpdateStudent,
  onDeleteStudent,
  onImportStudents,
  onResetPassword
}) => {
  const isTeacher = userRole === 'teacher';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'Nam' | 'Nữ'>('ALL');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [resettingStudent, setResettingStudent] = useState<Student | null>(null);
  const [resetSuccessPass, setResetSuccessPass] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);

  // Excel Import Preview Modal
  const [importPreviewRows, setImportPreviewRows] = useState<Partial<Student>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
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
      setShowImportModal(true);
    } catch (err: any) {
      alert(`Không thể đọc file Excel: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (importPreviewRows.length === 0) return;
    setIsImporting(true);
    try {
      const res = await onImportStudents(importPreviewRows);
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

  return (
    <div className="space-y-5">
      {/* Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search & Gender filter */}
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm theo họ tên, mã HS, số điện thoại..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#E06D85] focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setGenderFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                genderFilter === 'ALL' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-600'
              }`}
            >
              Tất cả ({students.length})
            </button>
            <button
              onClick={() => setGenderFilter('Nam')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                genderFilter === 'Nam' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Nam
            </button>
            <button
              onClick={() => setGenderFilter('Nữ')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                genderFilter === 'Nữ' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              Nữ
            </button>
          </div>
        </div>

        {/* Action Buttons for Teacher */}
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
              type="button"
              onClick={excelService.downloadStudentTemplate}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
              title="Tải file Excel mẫu chuẩn (gồm Mã HS, Họ tên, Giới tính, Ngày sinh, SĐT...)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Tải file mẫu Excel</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl border border-emerald-200 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Nhập danh sách học sinh từ file Excel (.xlsx)"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-700" />
              <span>Nhập Excel</span>
            </button>

            <button
              type="button"
              onClick={() => excelService.exportStudents(students)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
              title="Xuất toàn bộ danh sách học sinh kèm tài khoản ra Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
              <span>Xuất Excel</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="px-3.5 py-2 rounded-xl bg-[#E06D85] text-white text-xs font-bold hover:bg-[#C94C67] flex items-center gap-1.5 transition-all shadow-xs shadow-rose-200"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm học sinh</span>
            </button>
          </div>
        )}
      </div>

      {/* Students Data Table */}
      <div className="bg-white rounded-2xl border border-rose-100 shadow-xs overflow-hidden">
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
                      className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-left flex items-center gap-2"
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
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors"
                      title="Xem hồ sơ học sinh"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Hồ sơ</span>
                    </button>

                    {isTeacher && (
                      <>
                        <button
                          onClick={() => handleResetPasswordClick(st)}
                          className="p-1 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50"
                          title="Đặt lại mật khẩu mặc định (MSDDMMYYYY)"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(st)}
                          className="p-1 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50"
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
                          className="p-1 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50"
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

      {/* Add / Edit Student Modal */}
      {(showAddModal || editingStudent) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rose-100 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <h3 className="font-bold text-slate-800 text-base">
                {editingStudent ? `Sửa thông tin học sinh: ${editingStudent.name}` : 'Thêm học sinh mới'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingStudent(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-4 text-xs">
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
                  placeholder="Số nhà, đường, phường/xã, quận/huyện..."
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
                  placeholder="Ghi chú về sức khỏe, chức vụ lớp..."
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
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#E06D85] text-white font-bold hover:bg-[#C94C67] shadow-xs"
                >
                  {editingStudent ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {resettingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Đặt lại mật khẩu học sinh</h4>
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
                  className="w-full py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
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
                    className="px-3 py-1.5 rounded-xl border border-slate-200"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Excel Import Preview Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-rose-100 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Xem trước dữ liệu nhập từ Excel</h3>
                  <p className="text-xs text-slate-400">Kiểm tra thông tin trước khi lưu vào hệ thống</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error alerts from file reading */}
            {importErrors.length > 0 && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
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
                  <thead className="bg-slate-50 sticky top-0 border-b border-rose-100 text-slate-500 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">STT</th>
                      <th className="py-2.5 px-3">Mã HS</th>
                      <th className="py-2.5 px-3">Họ và tên</th>
                      <th className="py-2.5 px-3">Giới tính</th>
                      <th className="py-2.5 px-3">Ngày sinh</th>
                      <th className="py-2.5 px-3">Số điện thoại</th>
                      <th className="py-2.5 px-3">Địa chỉ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-50 text-slate-700">
                    {importPreviewRows.map((r, i) => (
                      <tr key={i} className="hover:bg-rose-50/20">
                        <td className="py-2 px-3 font-mono text-slate-400">{i + 1}</td>
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
              <span className="text-xs text-slate-500">
                {importPreviewRows.length > 0 ? `Sẵn sàng nhập ${importPreviewRows.length} học sinh` : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                >
                  Đóng
                </button>
                {importPreviewRows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isImporting ? 'Đang lưu...' : 'Xác nhận nhập vào lớp'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
