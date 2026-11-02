import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarCheck,
  Calendar,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  AlertCircle,
  Save,
  Check,
  Filter
} from 'lucide-react';
import type { Student, AttendanceRecord, AttendanceStatus, AppSettings, UserSession } from '../types';
import { attendanceApi } from '../services/api';

interface AttendanceViewProps {
  students: Student[];
  user: UserSession | null;
  settings: AppSettings;
  onRefreshData: () => Promise<void>;
  onOpenStudentProfile: (studentId: string, tab?: string) => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  students,
  user,
  settings,
  onRefreshData,
  onOpenStudentProfile
}) => {
  const isTeacher = user?.role === 'teacher';
  const todayStr = new Date().toISOString().substring(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [dateRecords, setDateRecords] = useState<Record<string, { status: AttendanceStatus; note: string }>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Load attendance for selectedDate
  const loadAttendanceForDate = async (date: string) => {
    setLoading(true);
    try {
      const records = await attendanceApi.get({ date });
      const map: Record<string, { status: AttendanceStatus; note: string }> = {};
      records.forEach(r => {
        map[r.studentId] = { status: r.status, note: r.note || '' };
      });
      // For any student without a record on this date, default to 'present' for easy checking
      students.forEach(s => {
        if (!map[s.id]) {
          map[s.id] = { status: 'present', note: '' };
        }
      });
      setDateRecords(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceForDate(selectedDate);
  }, [selectedDate, students]);

  // Set single student status
  const handleSetStatus = (studentId: string, status: AttendanceStatus) => {
    setDateRecords(prev => ({
      ...prev,
      [studentId]: {
        status,
        note: prev[studentId]?.note || ''
      }
    }));
  };

  // Set single student note
  const handleSetNote = (studentId: string, note: string) => {
    setDateRecords(prev => ({
      ...prev,
      [studentId]: {
        status: prev[studentId]?.status || 'present',
        note
      }
    }));
  };

  // Batch "Mark all as present"
  const handleMarkAllPresent = () => {
    const updated: Record<string, { status: AttendanceStatus; note: string }> = {};
    students.forEach(s => {
      updated[s.id] = {
        status: 'present',
        note: dateRecords[s.id]?.note || ''
      };
    });
    setDateRecords(updated);
  };

  // Save current date's attendance
  const handleSaveAttendance = async () => {
    setIsSaving(true);
    try {
      const items = Object.entries(dateRecords).map(([studentId, val]) => ({
        studentId,
        status: val.status,
        note: val.note
      }));
      await attendanceApi.batchSave(selectedDate, items);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu điểm danh');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick stats for selected date
  const counts = useMemo(() => {
    let p = 0, e = 0, u = 0, l = 0;
    Object.values(dateRecords).forEach(v => {
      if (v.status === 'present') p++;
      else if (v.status === 'late') l++;
      else if (v.status === 'excused_absence') e++;
      else if (v.status === 'unexcused_absence') u++;
    });
    return { present: p, late: l, excused: e, unexcused: u };
  }, [dateRecords]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Date Picker */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-rose-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-slate-800 text-lg sm:text-xl flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-[#E06D85]" />
            <span>Sổ điểm danh chuyên cần theo ngày</span>
          </h2>
          <p className="text-xs text-slate-400">
            Điểm danh nhanh cả lớp, đồng bộ tự động khi phát sinh sự việc thi đua
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-rose-50/70 p-1.5 rounded-xl border border-rose-100">
            <Calendar className="w-4 h-4 text-[#E06D85] ml-1" />
            <span className="text-xs font-semibold text-slate-700">Ngày:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-xs font-mono font-bold bg-transparent text-slate-900 pr-2 py-0.5 outline-hidden cursor-pointer"
            />
          </div>

          {isTeacher && (
            <button
              onClick={handleMarkAllPresent}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              Tất cả có mặt
            </button>
          )}

          {isTeacher && (
            <button
              onClick={handleSaveAttendance}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-[#E06D85] hover:bg-[#C94C67] text-white text-xs font-bold transition-all shadow-sm shadow-rose-200 flex items-center gap-1.5 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu điểm danh'}</span>
            </button>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Đã lưu sổ điểm danh ngày {selectedDate} thành công!</span>
        </div>
      )}

      {/* Summary KPI Strip for this date */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-rose-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Có mặt</span>
            <div className="text-2xl font-extrabold text-emerald-600 tabular-nums">{counts.present}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
            ✓
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-rose-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Đi muộn</span>
            <div className="text-2xl font-extrabold text-amber-600 tabular-nums">{counts.late}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
            ⏰
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-rose-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Vắng có phép</span>
            <div className="text-2xl font-extrabold text-blue-600 tabular-nums">{counts.excused}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
            P
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-rose-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Vắng không phép</span>
            <div className="text-2xl font-extrabold text-rose-600 tabular-nums">{counts.unexcused}</div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
            KP
          </div>
        </div>
      </div>

      {/* Attendance List */}
      <div className="bg-white rounded-3xl border border-rose-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FFF8F9] border-b border-rose-100 text-slate-500 font-bold uppercase text-[11px]">
              <tr>
                <th className="py-3 px-4 w-12 text-center">STT</th>
                <th className="py-3 px-4 w-28">Mã HS</th>
                <th className="py-3 px-4">Họ và tên</th>
                <th className="py-3 px-4 text-center">Trạng thái điểm danh</th>
                <th className="py-3 px-4">Ghi chú chuyên cần</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-50 text-slate-700">
              {students.map((st, idx) => {
                const current = dateRecords[st.id] || { status: 'present', note: '' };
                return (
                  <tr key={st.id} className="hover:bg-rose-50/20">
                    <td className="py-2.5 px-4 text-center font-mono text-slate-400 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                      {st.code}
                    </td>
                    <td className="py-2.5 px-4">
                      <button
                        onClick={() => onOpenStudentProfile(st.id, 'attendance')}
                        className="font-bold text-slate-900 hover:text-blue-600 text-left transition-colors"
                      >
                        {st.name}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                        <button
                          type="button"
                          disabled={!isTeacher}
                          onClick={() => handleSetStatus(st.id, 'present')}
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                            current.status === 'present'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Có mặt
                        </button>
                        <button
                          type="button"
                          disabled={!isTeacher}
                          onClick={() => handleSetStatus(st.id, 'late')}
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                            current.status === 'late'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Đi muộn
                        </button>
                        <button
                          type="button"
                          disabled={!isTeacher}
                          onClick={() => handleSetStatus(st.id, 'excused_absence')}
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                            current.status === 'excused_absence'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Có phép
                        </button>
                        <button
                          type="button"
                          disabled={!isTeacher}
                          onClick={() => handleSetStatus(st.id, 'unexcused_absence')}
                          className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                            current.status === 'unexcused_absence'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Không phép
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      {isTeacher ? (
                        <input
                          type="text"
                          value={current.note}
                          onChange={e => handleSetNote(st.id, e.target.value)}
                          placeholder="Lý do hoặc ghi chú..."
                          className="w-full px-2.5 py-1 rounded-lg border border-slate-200/80 bg-slate-50/50 text-xs focus:bg-white focus:ring-1 focus:ring-[#E06D85]"
                        />
                      ) : (
                        <span className="text-slate-500">{current.note || '--'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
