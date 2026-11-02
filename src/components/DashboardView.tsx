import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Award,
  Bell,
  TrendingUp,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import type { Student, AttendanceRecord, Announcement, Honor, ConductLog, AppSettings } from '../types';

interface DashboardViewProps {
  students: Student[];
  attendance: AttendanceRecord[];
  announcements: Announcement[];
  honors: Honor[];
  conductLogs: ConductLog[];
  settings: AppSettings;
  onNavigateTab: (tab: any) => void;
  onOpenStudentProfile: (studentId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  students,
  attendance,
  announcements,
  honors,
  conductLogs,
  settings,
  onNavigateTab,
  onOpenStudentProfile
}) => {
  // Time filter: all or by specific month (e.g., '2026-10', '2026-11')
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const todayStr = new Date().toISOString().substring(0, 10);
  const [attendanceDate, setAttendanceDate] = useState<string>(todayStr);

  // Filter conduct logs by selected month
  const filteredConductLogs = useMemo(() => {
    if (selectedMonth === 'ALL') return conductLogs;
    return conductLogs.filter(log => log.date.startsWith(selectedMonth));
  }, [conductLogs, selectedMonth]);

  // Total Students, Male, Female
  const totalStudents = students.length;
  const maleCount = students.filter(s => s.gender === 'Nam').length;
  const femaleCount = students.filter(s => s.gender === 'Nữ').length;

  // Attendance for selected date
  const todayRecords = useMemo(() => {
    return attendance.filter(a => a.date === attendanceDate);
  }, [attendance, attendanceDate]);

  const presentCount = todayRecords.filter(a => a.status === 'present').length;
  const excusedCount = todayRecords.filter(a => a.status === 'excused_absence').length;
  const unexcusedCount = todayRecords.filter(a => a.status === 'unexcused_absence').length;
  const lateCount = todayRecords.filter(a => a.status === 'late').length;
  // If not all recorded yet, assuming remaining are present by default or not yet checked
  const recordedStudents = new Set(todayRecords.map(r => r.studentId));
  const unrecordedCount = Math.max(0, totalStudents - recordedStudents.size);

  // Compute average conduct score
  const studentScores = useMemo(() => {
    const scores: Record<string, number> = {};
    students.forEach(s => {
      scores[s.id] = settings.baseConductScore || 100;
    });
    filteredConductLogs.forEach(l => {
      if (scores[l.studentId] !== undefined) {
        scores[l.studentId] += l.points;
      }
    });
    return scores;
  }, [students, filteredConductLogs, settings.baseConductScore]);

  const averageConductScore = useMemo(() => {
    if (totalStudents === 0) return 0;
    const sum = Object.values(studentScores).reduce((acc, curr) => acc + curr, 0);
    return Math.round((sum / totalStudents) * 10) / 10;
  }, [studentScores, totalStudents]);

  // Distribution by tiers
  const tierCounts = useMemo(() => {
    const counts = { 'Tốt': 0, 'Khá': 0, 'Đạt': 0, 'Cần rèn luyện': 0 };
    Object.values(studentScores).forEach(score => {
      if (score >= 90) counts['Tốt']++;
      else if (score >= 75) counts['Khá']++;
      else if (score >= 60) counts['Đạt']++;
      else counts['Cần rèn luyện']++;
    });
    return counts;
  }, [studentScores]);

  // Unique months available in conduct and attendance
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    conductLogs.forEach(l => {
      if (l.date && l.date.length >= 7) set.add(l.date.substring(0, 7));
    });
    attendance.forEach(a => {
      if (a.date && a.date.length >= 7) set.add(a.date.substring(0, 7));
    });
    set.add(todayStr.substring(0, 7));
    return Array.from(set).sort().reverse();
  }, [conductLogs, attendance, todayStr]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Welcome & Filter */}
      <div className="bg-gradient-to-r from-white via-rose-50/50 to-white rounded-2xl p-5 border border-rose-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100/70 text-[#C94C67]">
              Lớp {settings.className} · {settings.schoolYear}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">GVCN: {settings.teacherName}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
            Bảng điều khiển lớp chủ nhiệm
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Tổng quan tình hình học tập, nề nếp thi đua và chuyên cần thời gian thực.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-white p-1.5 rounded-xl border border-rose-100/80 shadow-xs">
          <Calendar className="w-4 h-4 text-[#E06D85] ml-2" />
          <span className="text-xs font-medium text-slate-600">Kỳ lọc:</span>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-xs font-semibold bg-transparent text-slate-800 pr-2 py-1 outline-hidden cursor-pointer"
          >
            <option value="ALL">Toàn năm học ({settings.schoolYear})</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>
                Tháng {m.split('-')[1]}/{m.split('-')[0]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Students */}
        <div
          onClick={() => onNavigateTab('students')}
          className="bg-white rounded-2xl p-4 border border-rose-100/90 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số học sinh</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-[#E06D85] group-hover:bg-[#E06D85] group-hover:text-white transition-colors">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tabular-nums">{totalStudents}</span>
            <span className="text-xs text-slate-400">học sinh</span>
          </div>
          <div className="mt-3 pt-3 border-t border-rose-50 flex items-center justify-between text-xs text-slate-600">
            <span>Nam: <strong className="text-blue-600 tabular-nums">{maleCount}</strong> ({totalStudents ? Math.round((maleCount / totalStudents) * 100) : 0}%)</span>
            <span>Nữ: <strong className="text-rose-600 tabular-nums">{femaleCount}</strong> ({totalStudents ? Math.round((femaleCount / totalStudents) * 100) : 0}%)</span>
          </div>
        </div>

        {/* Card 2: Attendance Today */}
        <div
          onClick={() => onNavigateTab('attendance')}
          className="bg-white rounded-2xl p-4 border border-rose-100/90 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chuyên cần hôm nay</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tabular-nums">{presentCount}</span>
            <span className="text-xs text-slate-400">/ {totalStudents} có mặt</span>
          </div>
          <div className="mt-3 pt-3 border-t border-rose-50 flex items-center gap-3 text-xs">
            <span className="text-amber-600 font-medium">Muộn: {lateCount}</span>
            <span className="text-rose-600 font-medium">Vắng: {excusedCount + unexcusedCount}</span>
            {unrecordedCount > 0 && (
              <span className="text-slate-400 text-[11px] truncate">Chưa điểm danh: {unrecordedCount}</span>
            )}
          </div>
        </div>

        {/* Card 3: Conduct Average */}
        <div
          onClick={() => onNavigateTab('conduct')}
          className="bg-white rounded-2xl p-4 border border-rose-100/90 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Điểm thi đua TB</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tabular-nums">{averageConductScore}</span>
            <span className="text-xs text-slate-400">/ 100 điểm chuẩn</span>
          </div>
          <div className="mt-3 pt-3 border-t border-rose-50 flex items-center justify-between text-xs text-slate-600">
            <span>Xếp loại Tốt: <strong className="text-emerald-600">{tierCounts['Tốt']}</strong></span>
            <span>Khá/Đạt: <strong className="text-amber-600">{tierCounts['Khá'] + tierCounts['Đạt']}</strong></span>
          </div>
        </div>

        {/* Card 4: Announcements & Honors */}
        <div
          onClick={() => onNavigateTab('notices_seating')}
          className="bg-white rounded-2xl p-4 border border-rose-100/90 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bảng tin & Vinh danh</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div>
              <span className="text-3xl font-extrabold text-slate-900 tabular-nums">{announcements.length}</span>
              <span className="text-xs text-slate-400 ml-1">tin</span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <div>
              <span className="text-3xl font-extrabold text-purple-600 tabular-nums">{honors.length}</span>
              <span className="text-xs text-slate-400 ml-1">vinh danh</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-rose-50 flex items-center justify-between text-xs text-purple-700 font-medium">
            <span>Xem sơ đồ & bảng tin</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Middle Section: Honors Showcase & Conduct Tiers Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Honors Spotlight (2 cols on lg) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-rose-100 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-rose-100/70">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">Gương sáng vinh danh lớp</h3>
            </div>
            <button
              onClick={() => onNavigateTab('notices_seating')}
              className="text-xs font-semibold text-[#C94C67] hover:underline flex items-center gap-1"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {honors.slice(0, 4).map(h => (
              <div
                key={h.id}
                onClick={() => onOpenStudentProfile(h.studentId)}
                className="p-3.5 rounded-xl border border-rose-100 bg-[#FFFDFC] hover:bg-rose-50/40 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-200 text-amber-900 flex items-center justify-center shrink-0 shadow-xs">
                    <Award className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-900 truncate group-hover:text-rose-700">
                        {h.studentName}
                      </h4>
                      <span className="text-[11px] text-slate-400 tabular-nums">{h.date}</span>
                    </div>
                    <p className="text-xs font-medium text-amber-700 mt-0.5 line-clamp-1">{h.title}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{h.description}</p>
                  </div>
                </div>
              </div>
            ))}
            {honors.length === 0 && (
              <div className="col-span-2 py-8 text-center text-xs text-slate-400">
                Chưa có học sinh nào được ghi nhận vinh danh trong kỳ này.
              </div>
            )}
          </div>
        </div>

        {/* Conduct Distribution */}
        <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-rose-100/70">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">Xếp loại thi đua</h3>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Tốt (≥ 90 điểm)</span>
                  <span className="font-bold text-emerald-600">{tierCounts['Tốt']} HS ({totalStudents ? Math.round((tierCounts['Tốt'] / totalStudents) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${totalStudents ? (tierCounts['Tốt'] / totalStudents) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Khá (75 - 89 điểm)</span>
                  <span className="font-bold text-blue-600">{tierCounts['Khá']} HS ({totalStudents ? Math.round((tierCounts['Khá'] / totalStudents) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${totalStudents ? (tierCounts['Khá'] / totalStudents) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Đạt (60 - 74 điểm)</span>
                  <span className="font-bold text-amber-600">{tierCounts['Đạt']} HS ({totalStudents ? Math.round((tierCounts['Đạt'] / totalStudents) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{ width: `${totalStudents ? (tierCounts['Đạt'] / totalStudents) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Cần rèn luyện (&lt; 60 điểm)</span>
                  <span className="font-bold text-rose-600">{tierCounts['Cần rèn luyện']} HS ({totalStudents ? Math.round((tierCounts['Cần rèn luyện'] / totalStudents) * 100) : 0}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all"
                    style={{ width: `${totalStudents ? (tierCounts['Cần rèn luyện'] / totalStudents) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('conduct')}
            className="mt-4 w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#C94C67] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Mở trang đánh giá thi đua</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Section: Recent Activities & Pinned Notice */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conduct & Discipline Logs */}
        <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-rose-100/70">
            <h3 className="font-bold text-slate-800 text-base">Ghi nhận thi đua gần đây</h3>
            <button
              onClick={() => onNavigateTab('conduct')}
              className="text-xs font-semibold text-[#C94C67] hover:underline"
            >
              Xem tất cả
            </button>
          </div>

          <div className="mt-3 divide-y divide-rose-50 max-h-[300px] overflow-y-auto">
            {conductLogs.slice(0, 6).map(log => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onOpenStudentProfile(log.studentId)}
                      className="font-bold text-slate-800 hover:text-rose-600 truncate"
                    >
                      {log.studentName}
                    </button>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span className="text-[11px] text-slate-400 tabular-nums">{log.date}</span>
                  </div>
                  <p className="text-slate-500 text-xs truncate mt-0.5">{log.ruleName}</p>
                </div>
                <div className={`font-bold tabular-nums shrink-0 px-2 py-0.5 rounded-md ${
                  log.points > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {log.points > 0 ? `+${log.points}` : log.points} điểm
                </div>
              </div>
            ))}
            {conductLogs.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">Chưa có sự việc thi đua nào được ghi nhận.</div>
            )}
          </div>
        </div>

        {/* Latest Announcements */}
        <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-rose-100/70">
            <h3 className="font-bold text-slate-800 text-base">Thông báo lớp học</h3>
            <button
              onClick={() => onNavigateTab('notices_seating')}
              className="text-xs font-semibold text-[#C94C67] hover:underline"
            >
              Mở bảng tin
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {announcements.slice(0, 3).map(a => (
              <div key={a.id} className="p-3 rounded-xl bg-[#FFF9FA] border border-rose-100/80">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-800 truncate">{a.title}</span>
                  {a.isPinned && (
                    <span className="px-2 py-0.5 rounded bg-rose-200/60 text-rose-800 text-[10px] font-bold">
                      Ghim
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                  {a.content}
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{a.author}</span>
                  <span>{a.createdAt}</span>
                </div>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">Chưa có thông báo nào được đăng.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
