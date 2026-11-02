import React, { useState, useMemo } from 'react';
import {
  Pin,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Save,
  Award,
  Newspaper,
  Send,
  Eye,
  FileText,
  User,
  Users,
  Search,
  Sparkles,
  Trophy,
  Star,
  Medal,
  Heart,
  RefreshCw,
  HelpCircle,
  X
} from 'lucide-react';
import type {
  Announcement,
  SeatingLayout,
  Seat,
  Honor,
  Student,
  Role,
  UserSession
} from '../types';

interface NoticeAndSeatingViewProps {
  announcements: Announcement[];
  seating: SeatingLayout;
  honors: Honor[];
  students: Student[];
  user: UserSession | null;
  onSaveSeating: (seats: Seat[]) => Promise<void>;
  onCreateAnnouncement: (data: Partial<Announcement>) => Promise<void>;
  onUpdateAnnouncement: (id: string, data: Partial<Announcement>) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  onCreateHonor: (data: Partial<Honor>) => Promise<void>;
  onUpdateHonor: (id: string, data: Partial<Honor>) => Promise<void>;
  onDeleteHonor: (id: string) => Promise<void>;
  onOpenStudentProfile: (studentId: string) => void;
}

export const NoticeAndSeatingView: React.FC<NoticeAndSeatingViewProps> = ({
  announcements,
  seating,
  honors,
  students,
  user,
  onSaveSeating,
  onCreateAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  onCreateHonor,
  onUpdateHonor,
  onDeleteHonor,
  onOpenStudentProfile
}) => {
  const isTeacher = user?.role === 'teacher';
  const [activeSubTab, setActiveSubTab] = useState<'seating' | 'notices' | 'honors' | 'composer'>('seating');

  // Seating state
  const [localSeats, setLocalSeats] = useState<Seat[]>(seating.seats || []);
  const [isProjectorMode, setIsProjectorMode] = useState<boolean>(false);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [isSavingSeating, setIsSavingSeating] = useState<boolean>(false);
  const [draggedSeatCode, setDraggedSeatCode] = useState<string | null>(null);

  // Sync if props change
  React.useEffect(() => {
    if (seating && seating.seats) {
      setLocalSeats(seating.seats);
    }
  }, [seating]);

  // Student map for fast lookup
  const studentMap = useMemo(() => {
    return new Map<string, Student>(students.map(s => [s.id, s]));
  }, [students]);

  // Assigned student IDs in seating
  const assignedStudentIds = useMemo(() => {
    const set = new Set<string>();
    localSeats.forEach(s => {
      if (s.studentId) set.add(s.studentId);
    });
    return set;
  }, [localSeats]);

  // Handle seat swap / assign
  const handleAssignStudent = (seatCode: string, studentId: string | null) => {
    setLocalSeats(prev => {
      const copy = [...prev];
      const targetIdx = copy.findIndex(s => s.seatCode === seatCode);
      if (targetIdx === -1) return prev;

      // If student was already seated elsewhere, clear that previous seat
      if (studentId) {
        copy.forEach((s, idx) => {
          if (s.studentId === studentId && idx !== targetIdx) {
            copy[idx] = { ...s, studentId: null };
          }
        });
      }

      copy[targetIdx] = { ...copy[targetIdx], studentId };
      return copy;
    });
    setSelectedSeat(null);
  };

  const handleSwapSeats = (sourceCode: string, targetCode: string) => {
    setLocalSeats(prev => {
      const copy = [...prev];
      const srcIdx = copy.findIndex(s => s.seatCode === sourceCode);
      const tgtIdx = copy.findIndex(s => s.seatCode === targetCode);
      if (srcIdx === -1 || tgtIdx === -1) return prev;

      const tempId = copy[srcIdx].studentId;
      copy[srcIdx] = { ...copy[srcIdx], studentId: copy[tgtIdx].studentId };
      copy[tgtIdx] = { ...copy[tgtIdx], studentId: tempId };
      return copy;
    });
  };

  const handleSaveSeatingClick = async () => {
    setIsSavingSeating(true);
    try {
      await onSaveSeating(localSeats);
    } finally {
      setIsSavingSeating(false);
    }
  };

  // Composer Form State
  const [composerType, setComposerType] = useState<'announcement' | 'honor'>('announcement');
  const [compTitle, setCompTitle] = useState('');
  const [compContent, setCompContent] = useState('');
  const [compCategory, setCompCategory] = useState<'Chung' | 'Học tập' | 'Hoạt động' | 'Khẩn cấp'>('Chung');
  const [compIsPinned, setCompIsPinned] = useState(false);
  const [compStudentId, setCompStudentId] = useState('');
  const [compBadge, setCompBadge] = useState<Honor['badge']>('trophy');
  const [compIsDraft, setCompIsDraft] = useState(false);
  const [composerSuccess, setComposerSuccess] = useState(false);

  const handlePublishFromComposer = async (isDraft: boolean) => {
    if (!compTitle.trim()) return;
    if (composerType === 'announcement') {
      await onCreateAnnouncement({
        title: compTitle,
        content: compContent,
        category: compCategory,
        isPinned: compIsPinned,
        isPublished: !isDraft
      });
    } else {
      if (!compStudentId) return;
      await onCreateHonor({
        studentId: compStudentId,
        title: compTitle,
        description: compContent,
        badge: compBadge,
        isPublished: !isDraft,
        date: new Date().toISOString().substring(0, 10)
      });
    }

    setCompTitle('');
    setCompContent('');
    setComposerSuccess(true);
    setTimeout(() => setComposerSuccess(false), 3000);
    setActiveSubTab(composerType === 'announcement' ? 'notices' : 'honors');
  };

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-rose-100/90 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto p-1">
          <button
            onClick={() => setActiveSubTab('seating')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSubTab === 'seating'
                ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/40'
            }`}
          >
            <Users className="w-4 h-4 text-[#E06D85]" />
            <span>Sơ đồ lớp (56 chỗ)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('notices')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSubTab === 'notices'
                ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/40'
            }`}
          >
            <Newspaper className="w-4 h-4 text-[#E06D85]" />
            <span>Bảng tin thông báo ({announcements.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('honors')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSubTab === 'honors'
                ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/40'
            }`}
          >
            <Award className="w-4 h-4 text-[#E06D85]" />
            <span>Vinh danh ({honors.length})</span>
          </button>

          {isTeacher && (
            <button
              onClick={() => setActiveSubTab('composer')}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeSubTab === 'composer'
                  ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/40'
              }`}
            >
              <Send className="w-4 h-4 text-[#E06D85]" />
              <span>Đăng thông tin mới</span>
            </button>
          )}
        </div>

        {/* Header Action for current subtab */}
        {activeSubTab === 'seating' && (
          <div className="flex items-center gap-2 px-2">
            <button
              onClick={() => setIsProjectorMode(!isProjectorMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                isProjectorMode
                  ? 'bg-slate-900 text-white border-slate-800'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
              title="Chế độ chiếu máy chiếu (Full màn hình, tương phản cao)"
            >
              {isProjectorMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isProjectorMode ? 'Thoát máy chiếu' : 'Chiếu máy chiếu'}</span>
            </button>

            {isTeacher && (
              <button
                onClick={handleSaveSeatingClick}
                disabled={isSavingSeating}
                className="px-4 py-1.5 rounded-xl bg-[#E06D85] hover:bg-[#C94C67] text-white text-xs font-bold transition-all shadow-sm shadow-rose-200 flex items-center gap-1.5 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingSeating ? 'Đang lưu...' : 'Lưu bố trí'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* SUBTAB 1: SEATING CHART */}
      {activeSubTab === 'seating' && (
        <div className={`space-y-4 ${isProjectorMode ? 'fixed inset-0 z-50 bg-slate-950 p-6 overflow-y-auto text-white' : ''}`}>
          {isProjectorMode && (
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-amber-300">Sơ đồ chỗ ngồi lớp học (56 chỗ)</span>
                <span className="text-sm text-slate-400">4 Dãy bàn · 7 Hàng · 2 Chỗ/bàn</span>
              </div>
              <button
                onClick={() => setIsProjectorMode(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold flex items-center gap-2 text-white"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Thu nhỏ</span>
              </button>
            </div>
          )}

          {/* Blackboard & Teacher Desk Zone */}
          <div className="max-w-5xl mx-auto space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-md border-2 border-emerald-900/50">
              {/* Teacher podium/desk */}
              <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700 order-2 sm:order-1">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                  GV
                </div>
                <div className="text-left">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Bàn giáo viên</div>
                  <div className="text-xs font-bold text-white">Cô Nguyễn Thị Mai</div>
                </div>
              </div>

              {/* Main Blackboard */}
              <div className="order-1 sm:order-2 flex-1 text-center py-2 px-6 rounded-xl bg-emerald-950/70 border border-emerald-700/60 shadow-inner">
                <span className="text-xs sm:text-sm font-bold tracking-widest text-emerald-200 uppercase">
                  ▲ BẢNG ĐEN LỚP HỌC ▲
                </span>
                <div className="text-[11px] text-emerald-300/70 mt-0.5">Cửa ra vào & Hướng nhìn từ bục giảng</div>
              </div>

              {/* Classroom door indicator */}
              <div className="order-3 hidden md:flex items-center gap-2 text-slate-400 text-xs px-3 py-2 border border-slate-700/60 rounded-xl">
                <span>🚪 Cửa chính</span>
              </div>
            </div>

            {/* Hint bar */}
            {!isProjectorMode && (
              <div className="flex items-center justify-between text-xs text-slate-500 px-2 py-1">
                <span>
                  {isTeacher
                    ? '💡 Bấm vào ghế hoặc kéo thả để xếp chỗ / đổi chỗ cho học sinh. 1 học sinh chỉ xếp tối đa 1 ghế.'
                    : '💡 Xem vị trí chỗ ngồi của bạn trên sơ đồ lớp học.'}
                </span>
                <span className="font-semibold text-rose-700">
                  Đã xếp: {assignedStudentIds.size}/56 chỗ ({students.length - assignedStudentIds.size} chưa xếp)
                </span>
              </div>
            )}

            {/* 4 Rows (Dãy 1 đến Dãy 4) Layout Grid */}
            <div className={`p-4 sm:p-6 rounded-3xl border shadow-xs ${
              isProjectorMode
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-rose-100/90'
            }`}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                {[1, 2, 3, 4].map(rowNum => {
                  return (
                    <div
                      key={rowNum}
                      className={`flex flex-col space-y-3 p-3 rounded-2xl border ${
                        isProjectorMode
                          ? 'bg-slate-950/60 border-slate-800'
                          : 'bg-[#FFFDFC] border-rose-100/70'
                      }`}
                    >
                      {/* Row Header */}
                      <div className="text-center py-1.5 px-3 rounded-xl bg-rose-50/70 text-[#C94C67] font-bold text-xs uppercase tracking-wider border border-rose-100/60">
                        Dãy {rowNum}
                      </div>

                      {/* 7 Desks in this Row */}
                      {[1, 2, 3, 4, 5, 6, 7].map(deskNum => {
                        const leftSeatCode = `D${rowNum}-B${deskNum}-T`;
                        const rightSeatCode = `D${rowNum}-B${deskNum}-P`;
                        const leftSeat = localSeats.find(s => s.seatCode === leftSeatCode);
                        const rightSeat = localSeats.find(s => s.seatCode === rightSeatCode);

                        const leftStudent = leftSeat?.studentId ? studentMap.get(leftSeat.studentId) : null;
                        const rightStudent = rightSeat?.studentId ? studentMap.get(rightSeat.studentId) : null;

                        const isMyLeftSeat = user?.role === 'student' && user.studentId === leftSeat?.studentId;
                        const isMyRightSeat = user?.role === 'student' && user.studentId === rightSeat?.studentId;

                        return (
                          <div
                            key={deskNum}
                            className={`p-2 rounded-xl border transition-all ${
                              isProjectorMode
                                ? 'bg-slate-900 border-slate-800'
                                : 'bg-white border-slate-200/60 shadow-xs'
                            }`}
                          >
                            <div className="text-[10px] text-slate-400 font-semibold mb-1 flex items-center justify-between">
                              <span>Bàn {deskNum}</span>
                              <span className="text-[9px] text-slate-300">D{rowNum}</span>
                            </div>

                            {/* 2 Seats (Left & Right) */}
                            <div className="grid grid-cols-2 gap-1.5">
                              {/* Left Seat */}
                              <div
                                draggable={isTeacher}
                                onDragStart={() => setDraggedSeatCode(leftSeatCode)}
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => {
                                  if (draggedSeatCode && draggedSeatCode !== leftSeatCode) {
                                    handleSwapSeats(draggedSeatCode, leftSeatCode);
                                    setDraggedSeatCode(null);
                                  }
                                }}
                                onClick={() => {
                                  if (isTeacher && leftSeat) {
                                    setSelectedSeat(leftSeat);
                                  } else if (leftStudent) {
                                    onOpenStudentProfile(leftStudent.id);
                                  }
                                }}
                                className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer min-h-[44px] flex flex-col justify-center items-center ${
                                  isMyLeftSeat
                                    ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400 shadow-md font-bold'
                                    : leftStudent
                                    ? leftStudent.gender === 'Nam'
                                      ? 'bg-blue-50/80 border-blue-200 text-blue-900 hover:bg-blue-100'
                                      : 'bg-rose-50/80 border-rose-200 text-rose-900 hover:bg-rose-100'
                                    : 'bg-slate-50 border-dashed border-slate-200 text-slate-400 hover:border-rose-300 hover:bg-rose-50/30'
                                }`}
                              >
                                <span className="text-[9px] text-slate-400 font-mono">T</span>
                                {leftStudent ? (
                                  <div className="w-full">
                                    <div className="text-[11px] font-bold truncate leading-tight">
                                      {leftStudent.name}
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-mono">
                                      {leftStudent.code}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Trống</span>
                                )}
                              </div>

                              {/* Right Seat */}
                              <div
                                draggable={isTeacher}
                                onDragStart={() => setDraggedSeatCode(rightSeatCode)}
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => {
                                  if (draggedSeatCode && draggedSeatCode !== rightSeatCode) {
                                    handleSwapSeats(draggedSeatCode, rightSeatCode);
                                    setDraggedSeatCode(null);
                                  }
                                }}
                                onClick={() => {
                                  if (isTeacher && rightSeat) {
                                    setSelectedSeat(rightSeat);
                                  } else if (rightStudent) {
                                    onOpenStudentProfile(rightStudent.id);
                                  }
                                }}
                                className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer min-h-[44px] flex flex-col justify-center items-center ${
                                  isMyRightSeat
                                    ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400 shadow-md font-bold'
                                    : rightStudent
                                    ? rightStudent.gender === 'Nam'
                                      ? 'bg-blue-50/80 border-blue-200 text-blue-900 hover:bg-blue-100'
                                      : 'bg-rose-50/80 border-rose-200 text-rose-900 hover:bg-rose-100'
                                    : 'bg-slate-50 border-dashed border-slate-200 text-slate-400 hover:border-rose-300 hover:bg-rose-50/30'
                                }`}
                              >
                                <span className="text-[9px] text-slate-400 font-mono">P</span>
                                {rightStudent ? (
                                  <div className="w-full">
                                    <div className="text-[11px] font-bold truncate leading-tight">
                                      {rightStudent.name}
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-mono">
                                      {rightStudent.code}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Trống</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* Classroom Aisles footer indicator */}
              <div className="mt-6 text-center text-xs text-slate-400">
                ▼ LỐI ĐI CHÍNH LỚP HỌC & CỬA SỔ HAI BÊN ▼
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seat Assignment Modal (Teacher only) */}
      {selectedSeat && isTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  Xếp chỗ ngồi: Vị trí {selectedSeat.seatCode}
                </h3>
                <p className="text-xs text-slate-400">
                  Dãy {selectedSeat.row} · Bàn {selectedSeat.desk} · Ghế {selectedSeat.position === 'L' ? 'Trái' : 'Phải'}
                </p>
              </div>
              <button
                onClick={() => setSelectedSeat(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Currently seated student */}
            {selectedSeat.studentId && (
              <div className="p-3 rounded-2xl bg-rose-50/50 border border-rose-100 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-400 font-semibold uppercase">Đang ngồi tại đây</div>
                  <div className="font-bold text-slate-800 text-sm">
                    {studentMap.get(selectedSeat.studentId)?.name}
                  </div>
                </div>
                <button
                  onClick={() => handleAssignStudent(selectedSeat.seatCode, null)}
                  className="px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold"
                >
                  Bỏ trống ghế này
                </button>
              </div>
            )}

            {/* Available students list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-1">
                Chọn học sinh để xếp chỗ:
              </div>
              <div className="space-y-1">
                {students.map(s => {
                  const isAlreadySeated = assignedStudentIds.has(s.id);
                  const isThisSeat = selectedSeat.studentId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleAssignStudent(selectedSeat.seatCode, s.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                        isThisSeat
                          ? 'bg-rose-100/60 border-rose-300 font-bold text-rose-900'
                          : isAlreadySeated
                          ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                          : 'bg-white border-rose-100 text-slate-800 hover:bg-rose-50 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-400">{s.code}</span>
                        <span className="font-semibold">{s.name}</span>
                        <span className="text-[10px] text-slate-400">({s.gender})</span>
                      </div>
                      <span className="text-[10px]">
                        {isThisSeat ? 'Đang ngồi' : isAlreadySeated ? 'Chuyển từ ghế khác' : 'Chưa xếp'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-rose-100 flex justify-end">
              <button
                onClick={() => setSelectedSeat(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: ANNOUNCEMENTS */}
      {activeSubTab === 'notices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-lg">Bảng tin thông báo lớp</h3>
            {isTeacher && (
              <button
                onClick={() => {
                  setComposerType('announcement');
                  setActiveSubTab('composer');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#E06D85] text-white text-xs font-bold hover:bg-[#C94C67] flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo thông báo</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {announcements.map(ann => (
              <div
                key={ann.id}
                className={`p-5 rounded-2xl border transition-all ${
                  ann.isPinned
                    ? 'bg-gradient-to-r from-rose-50/80 via-white to-white border-rose-300 shadow-xs ring-1 ring-rose-200/50'
                    : 'bg-white border-rose-100 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {ann.isPinned && (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-[#C94C67] text-[11px] font-bold flex items-center gap-1">
                          <Pin className="w-3 h-3 fill-current" />
                          <span>Đã ghim</span>
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                        {ann.category}
                      </span>
                      {!ann.isPublished && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                          Bản nháp
                        </span>
                      )}
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-400 tabular-nums">{ann.createdAt}</span>
                    </div>

                    <h4 className="font-bold text-slate-900 text-base sm:text-lg mt-1">
                      {ann.title}
                    </h4>

                    <p className="text-slate-700 text-sm mt-2 whitespace-pre-line leading-relaxed">
                      {ann.content}
                    </p>

                    <div className="mt-3 pt-3 border-t border-rose-50 flex items-center justify-between text-xs text-slate-500">
                      <span>Người đăng: <strong className="text-slate-700">{ann.author}</strong></span>
                    </div>
                  </div>

                  {isTeacher && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onUpdateAnnouncement(ann.id, { isPinned: !ann.isPinned })}
                        title={ann.isPinned ? 'Bỏ ghim' : 'Ghim thông báo'}
                        className={`p-1.5 rounded-lg border text-xs ${
                          ann.isPinned ? 'bg-rose-100 text-rose-700 border-rose-200' : 'text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        <Pin className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteAnnouncement(ann.id)}
                        title="Xóa thông báo"
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {announcements.length === 0 && (
              <div className="p-12 text-center text-sm text-slate-400 bg-white rounded-2xl border border-rose-100">
                Chưa có thông báo nào.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: HONORS */}
      {activeSubTab === 'honors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Bảng vàng vinh danh học sinh</h3>
              <p className="text-xs text-slate-400">Tuyên dương những nỗ lực và thành tích xuất sắc của tập thể lớp</p>
            </div>
            {isTeacher && (
              <button
                onClick={() => {
                  setComposerType('honor');
                  setActiveSubTab('composer');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#E06D85] text-white text-xs font-bold hover:bg-[#C94C67] flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm vinh danh</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {honors.map(hon => (
              <div
                key={hon.id}
                className="bg-white rounded-2xl p-5 border border-rose-100 shadow-xs hover:shadow-md transition-all relative flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 text-amber-900 flex items-center justify-center shrink-0 shadow-xs">
                      {hon.badge === 'trophy' && <Trophy className="w-6 h-6" />}
                      {hon.badge === 'star' && <Star className="w-6 h-6" />}
                      {hon.badge === 'medal' && <Medal className="w-6 h-6" />}
                      {hon.badge === 'heart' && <Heart className="w-6 h-6" />}
                      {hon.badge !== 'trophy' && hon.badge !== 'star' && hon.badge !== 'medal' && hon.badge !== 'heart' && (
                        <Award className="w-6 h-6" />
                      )}
                    </div>

                    {isTeacher && (
                      <button
                        onClick={() => onDeleteHonor(hon.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-opacity"
                        title="Xóa vinh danh"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-3">
                    <button
                      onClick={() => onOpenStudentProfile(hon.studentId)}
                      className="text-base font-bold text-slate-900 hover:text-rose-700 transition-colors text-left"
                    >
                      {hon.studentName}
                    </button>
                    <div className="text-xs font-semibold text-amber-700 mt-1">
                      {hon.title}
                    </div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-line">
                      {hon.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-rose-50 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Ngày vinh danh:</span>
                  <span className="font-semibold text-slate-600 tabular-nums">{hon.date}</span>
                </div>
              </div>
            ))}

            {honors.length === 0 && (
              <div className="col-span-3 p-12 text-center text-sm text-slate-400 bg-white rounded-2xl border border-rose-100">
                Chưa có học sinh nào được ghi danh trong bảng vàng.
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 4: COMPOSER (Teacher only) */}
      {activeSubTab === 'composer' && isTeacher && (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-rose-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-rose-100">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Đăng thông tin lớp học</h3>
              <p className="text-xs text-slate-400">Soạn thảo bảng tin thông báo hoặc khen thưởng vinh danh</p>
            </div>

            {/* Type selector */}
            <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-xl border border-rose-100">
              <button
                type="button"
                onClick={() => setComposerType('announcement')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  composerType === 'announcement'
                    ? 'bg-white text-rose-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Thông báo lớp
              </button>
              <button
                type="button"
                onClick={() => setComposerType('honor')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  composerType === 'honor'
                    ? 'bg-white text-rose-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Khen thưởng vinh danh
              </button>
            </div>
          </div>

          {composerSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Đã đăng nội dung thành công!</span>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            {composerType === 'honor' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Chọn học sinh được vinh danh *
                </label>
                <select
                  value={compStudentId}
                  onChange={e => setCompStudentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#E06D85]"
                >
                  <option value="">-- Chọn học sinh từ danh sách lớp --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name} ({s.gender})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {composerType === 'announcement' ? 'Tiêu đề thông báo *' : 'Tiêu đề thành tích / danh hiệu *'}
              </label>
              <input
                type="text"
                value={compTitle}
                onChange={e => setCompTitle(e.target.value)}
                placeholder={composerType === 'announcement' ? 'Ví dụ: Kế hoạch thi giữa kỳ môn Toán...' : 'Ví dụ: Đạt giải Nhất học sinh giỏi cấp Thành phố...'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#E06D85]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {composerType === 'announcement' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Chuyên mục
                  </label>
                  <select
                    value={compCategory}
                    onChange={e => setCompCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#E06D85]"
                  >
                    <option value="Chung">Chung</option>
                    <option value="Học tập">Học tập</option>
                    <option value="Hoạt động">Hoạt động phong trào</option>
                    <option value="Khẩn cấp">Khẩn cấp / Quan trọng</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Biểu tượng vinh danh
                  </label>
                  <select
                    value={compBadge}
                    onChange={e => setCompBadge(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#E06D85]"
                  >
                    <option value="trophy">🏆 Cúp vô địch / Giải nhất</option>
                    <option value="medal">🥇 Huy chương thành tích</option>
                    <option value="star">⭐ Ngôi sao sáng tiêu biểu</option>
                    <option value="lotus">🪷 Búp sen / Gương sáng chăm ngoan</option>
                    <option value="heart">💖 Trái tim nhân ái</option>
                  </select>
                </div>
              )}

              {composerType === 'announcement' && (
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={compIsPinned}
                      onChange={e => setCompIsPinned(e.target.checked)}
                      className="rounded text-[#E06D85] focus:ring-[#E06D85]"
                    />
                    <span>Ghim thông báo này lên đầu bảng tin</span>
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {composerType === 'announcement' ? 'Nội dung chi tiết *' : 'Lời chúc mừng và mô tả chi tiết'}
              </label>
              <textarea
                rows={5}
                value={compContent}
                onChange={e => setCompContent(e.target.value)}
                placeholder="Nhập nội dung đầy đủ..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-rose-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#E06D85]"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-rose-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => handlePublishFromComposer(true)}
              disabled={!compTitle.trim()}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Lưu bản nháp
            </button>

            <button
              type="button"
              onClick={() => handlePublishFromComposer(false)}
              disabled={!compTitle.trim() || (composerType === 'honor' && !compStudentId)}
              className="px-5 py-2 rounded-xl bg-[#E06D85] hover:bg-[#C94C67] text-white text-xs font-bold transition-all shadow-sm shadow-rose-200 flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>Đăng công bố ngay</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
