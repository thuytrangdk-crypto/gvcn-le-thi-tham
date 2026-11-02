import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  CalendarCheck,
  BookOpen,
  Flag,
  User,
  Phone,
  Calendar,
  MapPin,
  Clock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Award,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  CreditCard
} from 'lucide-react';
import type {
  Student,
  AttendanceRecord,
  GradeRecord,
  ConductLog,
  Honor,
  AppSettings,
  UserSession
} from '../types';
import { studentApi } from '../services/api';

interface StudentProfileViewProps {
  studentId: string;
  initialTab?: 'attendance' | 'academics' | 'conduct' | 'info';
  user: UserSession | null;
  settings: AppSettings;
  onBack: () => void;
  onRecordConduct?: (studentId: string) => void;
}

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  studentId,
  initialTab = 'info',
  user,
  settings,
  onBack,
  onRecordConduct
}) => {
  const isTeacher = user?.role === 'teacher';
  const [activeTab, setActiveTab] = useState<'attendance' | 'academics' | 'conduct' | 'info'>(initialTab);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<{
    student: Student;
    attendance: AttendanceRecord[];
    grades: GradeRecord[];
    conduct: ConductLog[];
    honors: Honor[];
  } | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await studentApi.getProfile(studentId);
      setProfileData(res);
    } catch (err: any) {
      setError(err.message || 'Không thể tải thông tin hồ sơ học sinh');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [studentId]);

  // Compute conduct score
  const totalConductScore = useMemo(() => {
    if (!profileData) return settings.baseConductScore || 100;
    const delta = profileData.conduct.reduce((sum, item) => sum + item.points, 0);
    return (settings.baseConductScore || 100) + delta;
  }, [profileData, settings.baseConductScore]);

  // Compute conduct rating
  const conductRating = useMemo(() => {
    if (totalConductScore >= 90) return { label: 'Tốt', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (totalConductScore >= 75) return { label: 'Khá', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (totalConductScore >= 60) return { label: 'Đạt', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { label: 'Cần rèn luyện', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  }, [totalConductScore]);

  // Attendance stats
  const attendanceStats = useMemo(() => {
    if (!profileData) return { present: 0, excused: 0, unexcused: 0, late: 0 };
    const p = profileData.attendance.filter(a => a.status === 'present').length;
    const e = profileData.attendance.filter(a => a.status === 'excused_absence').length;
    const u = profileData.attendance.filter(a => a.status === 'unexcused_absence').length;
    const l = profileData.attendance.filter(a => a.status === 'late').length;
    return { present: p, excused: e, unexcused: u, late: l };
  }, [profileData]);

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-rose-300 border-t-[#E06D85] rounded-full animate-spin mx-auto" />
        <p className="text-xs font-semibold text-slate-500">Đang tải hồ sơ học sinh...</p>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="p-8 text-center space-y-4 bg-white rounded-3xl border border-rose-100 max-w-lg mx-auto">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="font-bold text-slate-800 text-base">{error || 'Không tìm thấy hồ sơ'}</h3>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const { student, attendance, grades, conduct, honors } = profileData;
  const defaultPassword = `${student.code}${student.dob.replace(/\D/g, '')}`;

  return (
    <div className="space-y-6 pb-12">
      {/* Top back button */}
      {isTeacher && (
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white bg-white/70 border border-rose-100 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh sách học sinh</span>
        </button>
      )}

      {/* TOP CENTER HERO HEADER: Name in large beautiful blue font */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-rose-100 shadow-xs text-center space-y-3 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-400 via-rose-300 to-blue-400" />

        {/* Student Code Badge */}
        <div className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-mono text-xs font-bold border border-blue-100">
          Mã học sinh: {student.code} · Lớp {settings.className}
        </div>

        {/* Large Beautiful Blue Name as explicitly specified */}
        <h2 className="text-2xl sm:text-4xl font-extrabold text-blue-600 tracking-tight">
          {student.name}
        </h2>

        {/* Balanced, centered metadata below name */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-600 pt-1">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-slate-400">Giới tính:</span>
            <span className={`font-semibold ${student.gender === 'Nam' ? 'text-blue-600' : 'text-rose-600'}`}>
              {student.gender}
            </span>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Ngày sinh:</span>
            <span className="font-semibold text-slate-800 tabular-nums">{student.dob}</span>
          </div>

          <div className="flex items-center gap-1.5 font-medium">
            <Phone className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Số điện thoại:</span>
            <span className="font-semibold text-slate-800 tabular-nums">
              {student.phone || 'Chưa cập nhật'}
            </span>
          </div>
        </div>

        {/* Quick summary chips */}
        <div className="pt-3 border-t border-rose-50 flex items-center justify-center gap-4 text-xs">
          <span className="text-slate-500">
            Điểm rèn luyện: <strong className="text-slate-900 font-bold tabular-nums">{totalConductScore}</strong>
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">
            Xếp loại:{' '}
            <span className={`px-2 py-0.5 rounded-md font-bold text-xs border ${conductRating.color}`}>
              {conductRating.label}
            </span>
          </span>
          {honors.length > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>{honors.length} vinh danh</span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* 4 MAIN ACTION TABS: Điểm danh; Học tập; Thi đua; Thông tin học sinh */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-rose-100 shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'attendance'
              ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/30'
          }`}
        >
          <CalendarCheck className="w-4 h-4 text-[#E06D85]" />
          <span>Điểm danh</span>
        </button>

        <button
          onClick={() => setActiveTab('academics')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'academics'
              ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/30'
          }`}
        >
          <BookOpen className="w-4 h-4 text-[#E06D85]" />
          <span>Học tập</span>
        </button>

        <button
          onClick={() => setActiveTab('conduct')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'conduct'
              ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/30'
          }`}
        >
          <Flag className="w-4 h-4 text-[#E06D85]" />
          <span>Thi đua</span>
        </button>

        <button
          onClick={() => setActiveTab('info')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'info'
              ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/50'
              : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/30'
          }`}
        >
          <User className="w-4 h-4 text-[#E06D85]" />
          <span>Thông tin học sinh</span>
        </button>
      </div>

      {/* TAB CONTENT 1: ĐIỂM DANH */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-rose-100 text-center">
              <span className="text-xs text-slate-500 font-medium">Có mặt</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1 tabular-nums">{attendanceStats.present}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-rose-100 text-center">
              <span className="text-xs text-slate-500 font-medium">Đi muộn</span>
              <div className="text-2xl font-bold text-amber-600 mt-1 tabular-nums">{attendanceStats.late}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-rose-100 text-center">
              <span className="text-xs text-slate-500 font-medium">Vắng có phép</span>
              <div className="text-2xl font-bold text-blue-600 mt-1 tabular-nums">{attendanceStats.excused}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-rose-100 text-center">
              <span className="text-xs text-slate-500 font-medium">Vắng không phép</span>
              <div className="text-2xl font-bold text-rose-600 mt-1 tabular-nums">{attendanceStats.unexcused}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-rose-100 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-rose-100 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-sm">Nhật ký chuyên cần & điểm danh</h4>
              <span className="text-xs text-slate-400">Đồng bộ tự động cùng nề nếp thi đua</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF8F9] border-b border-rose-100 text-slate-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Ngày</th>
                    <th className="py-2.5 px-4">Trạng thái</th>
                    <th className="py-2.5 px-4">Ghi chú & Lý do</th>
                    <th className="py-2.5 px-4">Nguồn dữ liệu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50 text-slate-700">
                  {attendance.map(a => (
                    <tr key={a.id} className="hover:bg-rose-50/20">
                      <td className="py-2.5 px-4 font-mono font-semibold tabular-nums">{a.date}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          a.status === 'present'
                            ? 'bg-emerald-50 text-emerald-700'
                            : a.status === 'late'
                            ? 'bg-amber-50 text-amber-700'
                            : a.status === 'excused_absence'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {a.status === 'present' && 'Có mặt'}
                          {a.status === 'late' && 'Đi muộn'}
                          {a.status === 'excused_absence' && 'Vắng có phép'}
                          {a.status === 'unexcused_absence' && 'Vắng không phép'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{a.note || '--'}</td>
                      <td className="py-2.5 px-4 text-[11px] text-slate-400">
                        {a.linkedConductId ? 'Tự động từ sự việc thi đua' : 'Điểm danh trực tiếp'}
                      </td>
                    </tr>
                  ))}
                  {attendance.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        Chưa có lịch sử điểm danh riêng biệt nào được ghi nhận.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: HỌC TẬP */}
      {activeTab === 'academics' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-rose-100 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-rose-100 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Bảng điểm và đánh giá học tập</h4>
                <p className="text-xs text-slate-400">Điểm số và nhận xét môn học năm học {settings.schoolYear}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF8F9] border-b border-rose-100 text-slate-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Môn học</th>
                    <th className="py-2.5 px-4">Học kỳ</th>
                    <th className="py-2.5 px-4">Loại đánh giá</th>
                    <th className="py-2.5 px-4">Điểm / Nhận xét</th>
                    <th className="py-2.5 px-4">Ngày đánh giá</th>
                    <th className="py-2.5 px-4">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50 text-slate-700">
                  {grades.map(g => {
                    const sub = settings.subjects.find(s => s.id === g.subjectId);
                    return (
                      <tr key={g.id} className="hover:bg-rose-50/20">
                        <td className="py-2.5 px-4 font-bold text-slate-800">{sub?.name || g.subjectId}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-600">{g.semester}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">{g.assessmentType}</td>
                        <td className="py-2.5 px-4">
                          {g.score !== undefined ? (
                            <span className="font-mono text-sm font-bold text-blue-700 tabular-nums">
                              {g.score}
                            </span>
                          ) : (
                            <span className="font-semibold text-emerald-700">
                              {g.qualitativeRating || 'Đạt'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums">{g.date}</td>
                        <td className="py-2.5 px-4 text-slate-500">{g.note || '--'}</td>
                      </tr>
                    );
                  })}
                  {grades.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Chưa có dữ liệu điểm học tập nào được nhập cho học sinh này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: THI ĐUA */}
      {activeTab === 'conduct' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-rose-50/50 via-white to-rose-50/50 p-4 rounded-2xl border border-rose-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-medium">Tổng điểm thi đua hiện tại</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-extrabold text-slate-900 tabular-nums">{totalConductScore}</span>
                <span className="text-xs text-slate-400">/ {settings.baseConductScore || 100} điểm khởi tạo</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 font-medium">Xếp loại rèn luyện</span>
              <div className="mt-1">
                <span className={`px-3 py-1 rounded-xl font-bold text-sm border ${conductRating.color}`}>
                  {conductRating.label}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-rose-100 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-rose-100 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-sm">Lịch sử ghi nhận cộng / trừ điểm</h4>
              {isTeacher && onRecordConduct && (
                <button
                  onClick={() => onRecordConduct(student.id)}
                  className="px-3 py-1.5 rounded-xl bg-[#E06D85] text-white text-xs font-semibold hover:bg-[#C94C67] flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ghi nhận sự việc</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF8F9] border-b border-rose-100 text-slate-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Ngày</th>
                    <th className="py-2.5 px-4">Nội dung sự việc / Quy tắc</th>
                    <th className="py-2.5 px-4 text-center">Điểm cộng / trừ</th>
                    <th className="py-2.5 px-4">Ghi chú cụ thể</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50 text-slate-700">
                  {conduct.map(c => (
                    <tr key={c.id} className="hover:bg-rose-50/20">
                      <td className="py-2.5 px-4 font-mono font-semibold tabular-nums text-slate-600">{c.date}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{c.ruleName}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md font-mono font-bold text-xs ${
                          c.points > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {c.points > 0 ? `+${c.points}` : c.points}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{c.note || '--'}</td>
                    </tr>
                  ))}
                  {conduct.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        Chưa có sự việc cộng hoặc trừ điểm nào được ghi nhận.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: THÔNG TIN HỌC SINH */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Personal & Contact Details */}
          <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs space-y-4">
            <h4 className="font-bold text-slate-800 text-sm border-b border-rose-100 pb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-[#E06D85]" />
              <span>Thông tin liên hệ & Gia đình</span>
            </h4>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-rose-50">
                <span className="text-slate-400">Họ và tên đầy đủ:</span>
                <span className="font-bold text-slate-800">{student.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-rose-50">
                <span className="text-slate-400">Mã học sinh:</span>
                <span className="font-mono font-bold text-slate-800">{student.code}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-rose-50">
                <span className="text-slate-400">Giới tính:</span>
                <span className="font-semibold text-slate-800">{student.gender}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-rose-50">
                <span className="text-slate-400">Ngày tháng năm sinh:</span>
                <span className="font-mono text-slate-800">{student.dob}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-rose-50">
                <span className="text-slate-400">Số điện thoại học sinh:</span>
                <span className="font-mono text-slate-800">{student.phone || 'Chưa có'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-rose-50">
                <span className="text-slate-400">Địa chỉ thường trú:</span>
                <span className="text-slate-800 text-right">{student.address || 'Chưa cập nhật'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-rose-50">
                <span className="text-slate-400">Họ tên phụ huynh:</span>
                <span className="font-semibold text-slate-800">{student.parentName || 'Chưa có'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Số điện thoại phụ huynh:</span>
                <span className="font-mono text-slate-800">{student.parentPhone || 'Chưa có'}</span>
              </div>
            </div>
          </div>

          {/* Account & Security Card */}
          <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-slate-800 text-sm border-b border-rose-100 pb-2 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#E06D85]" />
                <span>Tài khoản truy cập học sinh</span>
              </h4>

              <div className="mt-3 space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-900 space-y-1">
                  <div className="font-bold text-[11px] uppercase tracking-wider text-blue-700">Tên đăng nhập hệ thống</div>
                  <div className="font-mono text-base font-bold text-blue-950">{student.code}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 space-y-1">
                  <div className="font-bold text-[11px] uppercase tracking-wider text-slate-500">Mật khẩu khởi tạo chuẩn (MSDDMMYYYY)</div>
                  <div className="font-mono text-sm font-bold text-slate-900">{defaultPassword}</div>
                  <p className="text-[11px] text-slate-400">
                    Gồm Mã học sinh ({student.code}) ghép cùng ngày sinh định dạng DDMMYYYY ({student.dob.replace(/\D/g, '')}).
                  </p>
                </div>

                {student.notes && (
                  <div className="p-3 rounded-xl bg-rose-50/40 border border-rose-100 text-slate-700">
                    <span className="font-bold text-[11px] text-rose-800 block mb-0.5">Ghi chú riêng:</span>
                    <p className="text-xs">{student.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-rose-50 text-[11px] text-slate-400 text-center">
              Tài khoản bảo mật máy chủ, học sinh chỉ có quyền xem dữ liệu cá nhân của chính mình.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
