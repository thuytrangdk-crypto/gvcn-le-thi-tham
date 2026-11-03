import React, { useState, useMemo } from 'react';
import {
  Users,
  UserX,
  AlertTriangle,
  Award,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CalendarCheck,
  Bell,
  ArrowRight,
  Filter
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
  // Active Tab for Left Column Card: 'attention' (Học sinh cần chú ý) or 'honors' (Gương sáng vinh danh)
  const [leftCardTab, setLeftCardTab] = useState<'attention' | 'honors'>('attention');
  const todayStr = new Date().toISOString().substring(0, 10);

  // Total Students, Male, Female
  const totalStudents = students.length;
  const maleCount = students.filter(s => s.gender === 'Nam').length;
  const femaleCount = students.filter(s => s.gender === 'Nữ').length;

  // Attendance for today
  const todayRecords = useMemo(() => {
    return attendance.filter(a => a.date === todayStr);
  }, [attendance, todayStr]);

  const presentCount = todayRecords.filter(a => a.status === 'present').length;
  const excusedCount = todayRecords.filter(a => a.status === 'excused_absence').length;
  const unexcusedCount = todayRecords.filter(a => a.status === 'unexcused_absence').length;
  const lateCount = todayRecords.filter(a => a.status === 'late').length;
  const totalAbsentToday = excusedCount + unexcusedCount;

  // Conduct Scores & Violation counts
  const { studentScores, studentViolations, studentLates, totalWeeklyViolations, totalMerits } = useMemo(() => {
    const scores: Record<string, number> = {};
    const violations: Record<string, number> = {};
    const lates: Record<string, number> = {};
    let weeklyViolations = 0;
    let merits = 0;

    students.forEach(s => {
      scores[s.id] = settings.baseConductScore || 100;
      violations[s.id] = 0;
      lates[s.id] = 0;
    });

    conductLogs.forEach(l => {
      if (scores[l.studentId] !== undefined) {
        scores[l.studentId] += l.points;
      }
      if (l.points < 0) {
        violations[l.studentId] = (violations[l.studentId] || 0) + 1;
        weeklyViolations += 1;
      } else if (l.points > 0) {
        merits += 1;
      }
    });

    attendance.forEach(a => {
      if (a.status === 'late' || a.status === 'unexcused_absence' || a.status === 'excused_absence') {
        lates[a.studentId] = (lates[a.studentId] || 0) + 1;
      }
    });

    return {
      studentScores: scores,
      studentViolations: violations,
      studentLates: lates,
      totalWeeklyViolations: weeklyViolations,
      totalMerits: merits
    };
  }, [students, conductLogs, attendance, settings.baseConductScore]);

  // Average Conduct Score
  const averageConductScore = useMemo(() => {
    if (totalStudents === 0) return 0;
    const sum = Object.values(studentScores).reduce((acc, curr) => acc + curr, 0);
    return Math.round((sum / totalStudents) * 10) / 10;
  }, [studentScores, totalStudents]);

  // Conduct Tiers
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

  // Students Needing Attention (8A3 Style)
  const attentionStudents = useMemo(() => {
    return students
      .map(s => {
        const vCount = studentViolations[s.id] || 0;
        const lCount = studentLates[s.id] || 0;
        const score = studentScores[s.id] ?? 100;
        return {
          student: s,
          violations: vCount,
          absentLate: lCount,
          score,
          needsAttention: vCount > 0 || lCount > 0 || score < 85
        };
      })
      .filter(item => item.needsAttention)
      .sort((a, b) => (b.violations * 2 + b.absentLate) - (a.violations * 2 + a.absentLate));
  }, [students, studentViolations, studentLates, studentScores]);

  // Initial letter avatar helper
  const getInitial = (name: string) => {
    const parts = name.trim().split(' ');
    const lastWord = parts[parts.length - 1] || 'H';
    return lastWord.charAt(0).toUpperCase();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. TOP BANNER (Exact 8A3 Layout in 7A1 Pink Identity) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#E06D85] via-[#E87994] to-[#F08A9F] p-6 sm:p-7 text-white shadow-lg shadow-rose-200/50">
        {/* Subtle decorative background circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-rose-400/20 blur-lg pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white drop-shadow-xs">
              {settings.appName || 'Trợ Lý Chủ Nhiệm'} • Lớp {settings.className || '7A1'}
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-rose-50 font-medium">
              Giáo viên chủ nhiệm: <strong className="text-white font-bold">{settings.teacherName || 'Cô Lê Thị Thắm'}</strong>
              {settings.schoolName && (
                <span className="hidden sm:inline"> — {settings.schoolName}</span>
              )}
            </p>
          </div>

          <div className="self-start md:self-auto">
            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/20 hover:bg-white/25 backdrop-blur-md border border-white/30 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors">
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Năm học {settings.schoolYear || '2025 - 2026'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ROW OF 4 STAT CARDS (8A3 Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Sĩ số lớp */}
        <div
          onClick={() => onNavigateTab('students')}
          className="bg-white rounded-3xl p-5 border border-rose-100 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sĩ số lớp</span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center text-[#E06D85] group-hover:bg-[#E06D85] group-hover:text-white transition-all shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {totalStudents}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            <span className="text-blue-600 font-bold">{maleCount}</span> Nam · <span className="text-rose-600 font-bold">{femaleCount}</span> Nữ
          </div>
        </div>

        {/* Card 2: Vắng (Hôm nay) */}
        <div
          onClick={() => onNavigateTab('attendance')}
          className="bg-white rounded-3xl p-5 border border-rose-100 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vắng (Hôm nay)</span>
            <div className="w-10 h-10 rounded-2xl bg-rose-50/80 flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-all shadow-2xs">
              <UserX className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {totalAbsentToday}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium">
            {totalAbsentToday === 0 ? (
              <span className="text-emerald-600 font-bold">Đi học đầy đủ 100%</span>
            ) : (
              <span>Muộn: <strong className="text-amber-600">{lateCount}</strong> · Vắng: <strong className="text-rose-600">{totalAbsentToday}</strong></span>
            )}
          </div>
        </div>

        {/* Card 3: Vi phạm (Tuần) / Thi đua */}
        <div
          onClick={() => onNavigateTab('conduct')}
          className="bg-white rounded-3xl p-5 border border-rose-100 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vi phạm (Tuần)</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-2xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {totalWeeklyViolations}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium truncate">
            {totalWeeklyViolations === 0 ? (
              <span className="text-emerald-600 font-semibold">Lớp chấp hành nề nếp tốt</span>
            ) : (
              <span>Lượt trừ điểm nề nếp ({averageConductScore} điểm TB)</span>
            )}
          </div>
        </div>

        {/* Card 4: Khen thưởng */}
        <div
          onClick={() => onNavigateTab('notices_seating')}
          className="bg-white rounded-3xl p-5 border border-rose-100 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khen thưởng</span>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-2xs">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              {honors.length}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-medium truncate">
            {honors.length > 0 ? (
              <span>Lượt vinh danh gương sáng ({announcements.length} thông báo)</span>
            ) : (
              <span>Lượt cộng điểm gương mẫu</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. TWO COLUMNS LAYOUT (8A3 Style) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMN 1: Học sinh cần chú ý & Gương sáng vinh danh (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-rose-100 shadow-xs flex flex-col min-h-[460px]">
          {/* Card Header with Toggle */}
          <div className="pb-4 border-b border-rose-100/80">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-2xs ${
                  leftCardTab === 'attention' ? 'bg-rose-50 text-[#E06D85]' : 'bg-amber-50 text-amber-600'
                }`}>
                  {leftCardTab === 'attention' ? <Bell className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">
                    {leftCardTab === 'attention' ? 'Học sinh cần chú ý' : 'Gương sáng vinh danh'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {leftCardTab === 'attention'
                      ? 'Nghỉ học nhiều, có lỗi vi phạm hoặc cần liên hệ PH'
                      : 'Học sinh có thành tích xuất sắc và việc tốt'}
                  </p>
                </div>
              </div>

              {leftCardTab === 'attention' && attentionStudents.length > 0 && (
                <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs border border-rose-100 shrink-0">
                  {attentionStudents.length} em
                </span>
              )}
            </div>

            {/* Quick Switch Tabs */}
            <div className="mt-3.5 flex rounded-xl bg-slate-100/80 p-1 text-xs font-semibold">
              <button
                onClick={() => setLeftCardTab('attention')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  leftCardTab === 'attention'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Cần chú ý ({attentionStudents.length})
              </button>
              <button
                onClick={() => setLeftCardTab('honors')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  leftCardTab === 'honors'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Vinh danh ({honors.length})
              </button>
            </div>
          </div>

          {/* List of Attention Students (8A3 Style) */}
          {leftCardTab === 'attention' && (
            <div className="mt-3 flex-1 divide-y divide-rose-50/80 max-h-[380px] overflow-y-auto pr-1">
              {attentionStudents.map(({ student, violations, absentLate, score }) => (
                <div
                  key={student.id}
                  onClick={() => onOpenStudentProfile(student.id)}
                  className="py-3 px-2 rounded-2xl hover:bg-rose-50/40 transition-colors cursor-pointer group flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-rose-50/80 border border-rose-100/90 text-[#E06D85] font-extrabold flex items-center justify-center shrink-0 text-sm shadow-2xs group-hover:bg-[#E06D85] group-hover:text-white transition-colors">
                      {getInitial(student.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-tight truncate group-hover:text-rose-700">
                        {student.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {violations > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-bold">
                            Vi phạm: {violations}
                          </span>
                        )}
                        {absentLate > 0 && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold">
                            Vắng/muộn: {absentLate}
                          </span>
                        )}
                        {score < 90 && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                            {score} điểm
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              ))}

              {attentionStudents.length === 0 && (
                <div className="py-16 text-center text-xs text-slate-400">
                  Tuyệt vời! Không có học sinh nào bị cảnh báo nề nếp hoặc vắng học nhiều.
                </div>
              )}
            </div>
          )}

          {/* List of Honors Students */}
          {leftCardTab === 'honors' && (
            <div className="mt-3 flex-1 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {honors.map(h => (
                <div
                  key={h.id}
                  onClick={() => onOpenStudentProfile(h.studentId)}
                  className="p-3 rounded-2xl border border-rose-100 bg-[#FFFDFC] hover:bg-rose-50/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
                      <Award className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase truncate group-hover:text-rose-700">
                          {h.studentName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">{h.date}</span>
                      </div>
                      <p className="text-xs font-bold text-amber-700 mt-0.5 line-clamp-1">{h.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{h.description}</p>
                    </div>
                  </div>
                </div>
              ))}

              {honors.length === 0 && (
                <div className="py-16 text-center text-xs text-slate-400">
                  Chưa có vinh danh nào được ghi nhận.
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUMN 2: Hoạt động gần đây & Xếp loại thi đua (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Hoạt động gần đây (8A3 Style) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-rose-100 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-rose-100/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 text-[#E06D85] flex items-center justify-center shadow-2xs">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">Hoạt động gần đây</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Nhật ký thi đua, khen thưởng và trao đổi
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('conduct')}
                className="text-xs font-bold text-[#C94C67] hover:underline flex items-center gap-1"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Timeline List (8A3 Style) */}
            <div className="mt-3 divide-y divide-rose-50/80 max-h-[300px] overflow-y-auto pr-1">
              {conductLogs.slice(0, 6).map(log => {
                const isPositive = log.points > 0;
                return (
                  <div
                    key={log.id}
                    onClick={() => onOpenStudentProfile(log.studentId)}
                    className="py-3 px-2 rounded-2xl hover:bg-rose-50/30 transition-colors cursor-pointer group flex items-start gap-3"
                  >
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${
                        isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {isPositive ? (
                        <Award className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-xs sm:text-sm text-slate-800 uppercase tracking-tight truncate group-hover:text-rose-700">
                          {log.studentName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono shrink-0 tabular-nums">
                          {log.date}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">{log.ruleName}</p>
                      {log.note && (
                        <p className="text-[11px] text-slate-400 italic line-clamp-1 mt-0.5">
                          "{log.note}"
                        </p>
                      )}
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold shrink-0 tabular-nums ${
                        isPositive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}
                    >
                      {isPositive ? `+${log.points}` : log.points} điểm
                    </span>
                  </div>
                );
              })}

              {conductLogs.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400">
                  Chưa có ghi nhận hoạt động nào gần đây.
                </div>
              )}
            </div>
          </div>

          {/* Card: Xếp loại thi đua (Conduct Tiers Progress) */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-rose-100 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm sm:text-base">Xếp loại thi đua</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Thống kê nề nếp toàn lớp theo 4 mức chuẩn
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold text-slate-500">
                TB: <strong className="text-slate-800">{averageConductScore}</strong> / 100
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Tốt (≥ 90 điểm)</span>
                  <span className="font-bold text-emerald-600">
                    {tierCounts['Tốt']} HS ({totalStudents ? Math.round((tierCounts['Tốt'] / totalStudents) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalStudents ? (tierCounts['Tốt'] / totalStudents) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Khá (75 - 89 điểm)</span>
                  <span className="font-bold text-blue-600">
                    {tierCounts['Khá']} HS ({totalStudents ? Math.round((tierCounts['Khá'] / totalStudents) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalStudents ? (tierCounts['Khá'] / totalStudents) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Đạt (60 - 74 điểm)</span>
                  <span className="font-bold text-amber-600">
                    {tierCounts['Đạt']} HS ({totalStudents ? Math.round((tierCounts['Đạt'] / totalStudents) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalStudents ? (tierCounts['Đạt'] / totalStudents) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Cần rèn luyện (&lt; 60 điểm)</span>
                  <span className="font-bold text-rose-600">
                    {tierCounts['Cần rèn luyện']} HS ({totalStudents ? Math.round((tierCounts['Cần rèn luyện'] / totalStudents) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalStudents ? (tierCounts['Cần rèn luyện'] / totalStudents) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
