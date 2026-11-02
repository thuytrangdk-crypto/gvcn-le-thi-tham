import React, { useState, useMemo, useEffect } from 'react';
import {
  Flag,
  Calendar,
  Save,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Filter,
  User,
  Check,
  X,
  Sparkles,
  TrendingUp,
  FileCheck2,
  Info
} from 'lucide-react';
import type {
  Student,
  ConductRule,
  ConductLog,
  AppSettings,
  PeriodEvaluation,
  UserSession
} from '../types';
import { conductApi } from '../services/api';

interface ConductViewProps {
  students: Student[];
  rules: ConductRule[];
  conductLogs: ConductLog[];
  settings: AppSettings;
  user: UserSession | null;
  selectedStudentIdPreset?: string;
  onRefreshData: () => Promise<void>;
  onOpenStudentProfile: (studentId: string, tab?: string) => void;
}

export const ConductView: React.FC<ConductViewProps> = ({
  students,
  rules,
  conductLogs,
  settings,
  user,
  selectedStudentIdPreset,
  onRefreshData,
  onOpenStudentProfile
}) => {
  const isTeacher = user?.role === 'teacher';

  // Area A: Form state
  const todayStr = new Date().toISOString().substring(0, 10);
  const [formStudentId, setFormStudentId] = useState<string>(selectedStudentIdPreset || '');
  const [formDate, setFormDate] = useState<string>(todayStr);
  const [formRuleId, setFormRuleId] = useState<string>('');
  const [formPoints, setFormPoints] = useState<number>(0);
  const [formNote, setFormNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Area B: Period filter
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [evaluations, setEvaluations] = useState<Record<string, PeriodEvaluation>>({});
  const [savingEvaluations, setSavingEvaluations] = useState<boolean>(false);
  const [editingStudentEval, setEditingStudentEval] = useState<string | null>(null);
  const [evalConfirmedRating, setEvalConfirmedRating] = useState<'Tốt' | 'Khá' | 'Đạt' | 'Cần rèn luyện'>('Tốt');
  const [evalReason, setEvalReason] = useState<string>('');

  // Area C: Edit modal
  const [editingLog, setEditingLog] = useState<ConductLog | null>(null);
  const [editLogPoints, setEditLogPoints] = useState<number>(0);
  const [editLogDate, setEditLogDate] = useState<string>('');
  const [editLogNote, setEditLogNote] = useState<string>('');

  useEffect(() => {
    if (selectedStudentIdPreset) {
      setFormStudentId(selectedStudentIdPreset);
    }
  }, [selectedStudentIdPreset]);

  // When rule changes in Form A, auto-fill points
  const handleRuleChange = (ruleId: string) => {
    setFormRuleId(ruleId);
    const selected = rules.find(r => r.id === ruleId);
    if (selected) {
      setFormPoints(selected.points);
    }
  };

  // Load Period Evaluations when selectedPeriod changes
  useEffect(() => {
    conductApi.getEvaluations(selectedPeriod).then(res => {
      setEvaluations(res || {});
    }).catch(() => {});
  }, [selectedPeriod]);

  // Filter conduct logs by selected period (month or ALL)
  const filteredLogs = useMemo(() => {
    if (selectedPeriod === 'ALL') return conductLogs;
    return conductLogs.filter(l => l.date && l.date.startsWith(selectedPeriod));
  }, [conductLogs, selectedPeriod]);

  // Compute total scores per student for the selected period
  const studentScores = useMemo(() => {
    const scores: Record<string, number> = {};
    students.forEach(s => {
      scores[s.id] = settings.baseConductScore || 100;
    });
    filteredLogs.forEach(l => {
      if (scores[l.studentId] !== undefined) {
        scores[l.studentId] += l.points;
      }
    });
    return scores;
  }, [students, filteredLogs, settings.baseConductScore]);

  // Calculate rating based on configured tiers in Settings
  const getCalculatedRating = (score: number): 'Tốt' | 'Khá' | 'Đạt' | 'Cần rèn luyện' => {
    const tiers = settings.evaluationTiers || [
      { rating: 'Tốt', minScore: 90 },
      { rating: 'Khá', minScore: 75 },
      { rating: 'Đạt', minScore: 60 },
      { rating: 'Cần rèn luyện', minScore: 0 }
    ];
    for (const t of tiers) {
      if (score >= t.minScore) return t.rating;
    }
    return 'Cần rèn luyện';
  };

  // Available months
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    conductLogs.forEach(l => {
      if (l.date && l.date.length >= 7) set.add(l.date.substring(0, 7));
    });
    set.add(todayStr.substring(0, 7));
    return Array.from(set).sort().reverse();
  }, [conductLogs, todayStr]);

  // Save new conduct event (Area A)
  const handleSaveConduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId) {
      setFormError('Vui lòng chọn học sinh');
      return;
    }
    if (!formRuleId) {
      setFormError('Vui lòng chọn quy tắc thi đua');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      await conductApi.createLog({
        studentId: formStudentId,
        ruleId: formRuleId,
        date: formDate,
        points: formPoints,
        note: formNote
      });

      setSaveSuccessMsg('Ghi nhận sự việc thành công và tự động đồng bộ điểm danh nếu có liên kết!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);

      setFormNote('');
      await onRefreshData();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu sự việc');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete conduct log with confirmation
  const handleDeleteLog = async (log: ConductLog) => {
    if (!confirm(`Xác nhận xóa sự việc "${log.ruleName}" của học sinh ${log.studentName}? Tổng điểm và điểm danh liên quan sẽ được tự động cập nhật lại.`)) {
      return;
    }
    try {
      await conductApi.deleteLog(log.id);
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa sự việc');
    }
  };

  // Edit conduct log
  const handleSaveEditLog = async () => {
    if (!editingLog) return;
    try {
      await conductApi.updateLog(editingLog.id, {
        points: editLogPoints,
        date: editLogDate,
        note: editLogNote
      });
      setEditingLog(null);
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật');
    }
  };

  // Confirm or Override Evaluation
  const handleConfirmEvaluation = async (studentId: string) => {
    const currentScore = studentScores[studentId] ?? (settings.baseConductScore || 100);
    const calculated = getCalculatedRating(currentScore);

    const updated = {
      ...evaluations,
      [studentId]: {
        studentId,
        period: selectedPeriod,
        totalScore: currentScore,
        calculatedRating: calculated,
        confirmedRating: evalConfirmedRating,
        reason: evalReason.trim(),
        updatedAt: new Date().toISOString()
      }
    };

    setSavingEvaluations(true);
    try {
      await conductApi.saveEvaluations(selectedPeriod, updated);
      setEvaluations(updated);
      setEditingStudentEval(null);
      setEvalReason('');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu đánh giá');
    } finally {
      setSavingEvaluations(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-800 text-lg sm:text-xl flex items-center gap-2">
            <Flag className="w-5 h-5 text-[#E06D85]" />
            <span>Quản trị thi đua & rèn luyện nề nếp</span>
          </h2>
          <p className="text-xs text-slate-400">
            Ghi nhận khen thưởng, trừ điểm vi phạm, tự động liên kết điểm danh và xếp loại rèn luyện
          </p>
        </div>

        {/* Period Filter for Area B and Area C */}
        <div className="flex items-center gap-2 bg-rose-50/70 p-1.5 rounded-xl border border-rose-100">
          <Calendar className="w-4 h-4 text-[#E06D85] ml-1" />
          <span className="text-xs font-semibold text-slate-600">Kỳ đánh giá:</span>
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="text-xs font-bold bg-transparent text-slate-800 pr-2 py-0.5 outline-hidden cursor-pointer"
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

      {/* Main Grid: Desktop 2 Columns (Left: Area A; Right: Area B on top, Area C on bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= AREA A: GHI NHẬN SỰ VIỆC (LEFT COLUMN - 5 COLS ON LG) ================= */}
        {isTeacher && (
          <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-rose-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <span>Khu vực A: Ghi nhận sự việc</span>
              </h3>
              <span className="text-[11px] text-slate-400">Tự động cập nhật</span>
            </div>

            {saveSuccessMsg && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {formError && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveConduct} className="space-y-4 text-xs">
              {/* Select Student */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Chọn học sinh *
                </label>
                <select
                  value={formStudentId}
                  onChange={e => setFormStudentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85] text-xs font-semibold"
                >
                  <option value="">-- Bấm để chọn học sinh trong lớp --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name} ({s.gender})
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Date */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  2. Ngày xảy ra sự việc * (mặc định hôm nay)
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85] text-xs font-mono"
                />
              </div>

              {/* Select Rule from Settings */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  3. Chọn quy tắc thi đua *
                </label>
                <select
                  value={formRuleId}
                  onChange={e => handleRuleChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85] text-xs font-semibold"
                >
                  <option value="">-- Chọn quy tắc từ danh mục Cài đặt --</option>
                  {rules.map(r => (
                    <option key={r.id} value={r.id}>
                      [{r.category}] {r.name} ({r.points > 0 ? `+${r.points}` : r.points} điểm)
                      {r.linkAttendance ? ' ⇄ Liên kết điểm danh' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto points display / override */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-rose-50/50 border border-rose-100">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-500 block mb-1">
                    Điểm cộng / trừ:
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formPoints}
                      onChange={e => setFormPoints(Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded-lg border border-rose-200 font-mono font-bold text-sm text-center tabular-nums"
                    />
                    <span className="font-bold text-xs text-slate-600">điểm</span>
                  </div>
                </div>

                <div className="text-right flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400">Trạng thái liên kết:</span>
                  <span className="text-xs font-semibold text-rose-700">
                    {rules.find(r => r.id === formRuleId)?.linkAttendance
                      ? '⚡ Tự cập nhật điểm danh'
                      : 'Không liên kết'}
                  </span>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  4. Ghi chú cụ thể (chi tiết lý do / minh chứng)
                </label>
                <textarea
                  rows={3}
                  value={formNote}
                  onChange={e => setFormNote(e.target.value)}
                  placeholder="Ví dụ: Đi muộn 15 phút tiết 1, hoặc giải Nhất cờ vua cấp trường..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85] text-xs"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 rounded-2xl bg-[#E06D85] hover:bg-[#C94C67] text-white text-xs font-bold transition-all shadow-sm shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu ghi nhận sự việc'}</span>
              </button>
            </form>
          </div>
        )}

        {/* ================= RIGHT COLUMN (7 COLS ON LG): AREA B + AREA C ================= */}
        <div className={`space-y-6 ${isTeacher ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          {/* ================= AREA B: BẢNG KỲ ĐÁNH GIÁ (TOP RIGHT) ================= */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-rose-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  Khu vực B: Bảng kỳ đánh giá ({selectedPeriod === 'ALL' ? 'Toàn năm học' : `Tháng ${selectedPeriod.split('-')[1]}`})
                </h3>
                <p className="text-xs text-slate-400">
                  Tổng điểm thi đua & Xếp loại kết quả rèn luyện học sinh (có thể xác nhận/chỉnh sửa)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[300px] border border-rose-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF8F9] sticky top-0 z-10 border-b border-rose-100 text-slate-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Mã HS</th>
                    <th className="py-2.5 px-3">Họ và tên</th>
                    <th className="py-2.5 px-3 text-center">Tổng điểm</th>
                    <th className="py-2.5 px-3">Xếp loại rèn luyện</th>
                    {isTeacher && <th className="py-2.5 px-3 text-right">Xác nhận / Sửa</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50 text-slate-700">
                  {students.map(st => {
                    const score = studentScores[st.id] ?? (settings.baseConductScore || 100);
                    const calculated = getCalculatedRating(score);
                    const savedEval = evaluations[st.id];
                    const activeRating = savedEval?.confirmedRating || calculated;

                    return (
                      <tr key={st.id} className="hover:bg-rose-50/20">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{st.code}</td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => onOpenStudentProfile(st.id, 'conduct')}
                            className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-left"
                          >
                            {st.name}
                          </button>
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-sm tabular-nums">
                          <span className={score >= 90 ? 'text-emerald-700' : score >= 75 ? 'text-blue-700' : 'text-slate-800'}>
                            {score}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              activeRating === 'Tốt'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : activeRating === 'Khá'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : activeRating === 'Đạt'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {activeRating}
                            </span>
                            {savedEval?.confirmedRating && (
                              <span className="text-[10px] text-amber-700 font-medium" title={savedEval.reason || 'Đã xác nhận'}>
                                (Đã điều chỉnh)
                              </span>
                            )}
                          </div>
                        </td>
                        {isTeacher && (
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => {
                                setEditingStudentEval(st.id);
                                setEvalConfirmedRating(activeRating);
                                setEvalReason(savedEval?.reason || '');
                              }}
                              className="px-2 py-1 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 font-semibold text-[11px]"
                            >
                              Xác nhận
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ================= AREA C: LỊCH SỬ GHI NHẬN (BOTTOM RIGHT) ================= */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-rose-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  Khu vực C: Lịch sử ghi nhận ({filteredLogs.length} sự việc)
                </h3>
                <p className="text-xs text-slate-400">
                  Cuộn dọc riêng, tiêu đề cố định, sắp xếp mới nhất trước. Sửa/xóa tự cập nhật tổng điểm và chuyên cần.
                </p>
              </div>
            </div>

            {/* Scrollable table container with sticky header and max height */}
            <div className="overflow-x-auto max-h-[380px] overflow-y-auto border border-rose-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FFF8F9] sticky top-0 z-10 border-b border-rose-100 text-slate-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Ngày</th>
                    <th className="py-2.5 px-3">Học sinh</th>
                    <th className="py-2.5 px-3">Sự việc</th>
                    <th className="py-2.5 px-3 text-center">Điểm</th>
                    <th className="py-2.5 px-3">Ghi chú</th>
                    {isTeacher && <th className="py-2.5 px-3 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50 text-slate-700">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-rose-50/20">
                      <td className="py-2.5 px-3 font-mono font-semibold tabular-nums text-slate-600 whitespace-nowrap">
                        {log.date}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                        <button
                          onClick={() => onOpenStudentProfile(log.studentId, 'conduct')}
                          className="hover:text-blue-600 transition-colors"
                        >
                          {log.studentName}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">
                        {log.ruleName}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] ${
                          log.points > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {log.points > 0 ? `+${log.points}` : log.points}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 truncate max-w-[140px]" title={log.note}>
                        {log.note || '--'}
                      </td>
                      {isTeacher && (
                        <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1">
                          <button
                            onClick={() => {
                              setEditingLog(log);
                              setEditLogPoints(log.points);
                              setEditLogDate(log.date);
                              setEditLogNote(log.note || '');
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50"
                            title="Sửa sự việc"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50"
                            title="Xóa sự việc"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Chưa có sự việc thi đua nào trong kỳ được chọn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Evaluation Override Modal */}
      {editingStudentEval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <h4 className="font-bold text-slate-800 text-sm">
                Xác nhận / Điều chỉnh kết quả rèn luyện kỳ
              </h4>
              <button
                onClick={() => setEditingStudentEval(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Mức đánh giá chính thức *
                </label>
                <select
                  value={evalConfirmedRating}
                  onChange={e => setEvalConfirmedRating(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 font-bold"
                >
                  <option value="Tốt">Tốt</option>
                  <option value="Khá">Khá</option>
                  <option value="Đạt">Đạt</option>
                  <option value="Cần rèn luyện">Cần rèn luyện</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Lý do điều chỉnh / Ghi chú của GVCN
                </label>
                <textarea
                  rows={3}
                  value={evalReason}
                  onChange={e => setEvalReason(e.target.value)}
                  placeholder="Ghi nhận nỗ lực tiến bộ hoặc nhận xét..."
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudentEval(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmEvaluation(editingStudentEval)}
                  disabled={savingEvaluations}
                  className="px-4 py-1.5 rounded-xl bg-[#E06D85] text-white font-bold hover:bg-[#C94C67]"
                >
                  {savingEvaluations ? 'Đang lưu...' : 'Lưu kết quả'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Log Modal */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <h4 className="font-bold text-slate-800 text-sm">
                Sửa sự việc: {editingLog.ruleName}
              </h4>
              <button
                onClick={() => setEditingLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Ngày xảy ra</label>
                <input
                  type="date"
                  value={editLogDate}
                  onChange={e => setEditLogDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Điểm số (+/-)</label>
                <input
                  type="number"
                  value={editLogPoints}
                  onChange={e => setEditLogPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Ghi chú</label>
                <textarea
                  rows={3}
                  value={editLogNote}
                  onChange={e => setEditLogNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditLog}
                  className="px-4 py-1.5 rounded-xl bg-[#E06D85] text-white font-bold hover:bg-[#C94C67]"
                >
                  Cập nhật
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
