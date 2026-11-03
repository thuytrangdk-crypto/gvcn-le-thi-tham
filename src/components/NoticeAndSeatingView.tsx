import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  X,
  Image as ImageIcon,
  Video as VideoIcon,
  Link as LinkIcon,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Play,
  Volume2
} from 'lucide-react';
import type {
  Announcement,
  AnnouncementImage,
  AnnouncementVideo,
  AnnouncementLink,
  SeatingLayout,
  Seat,
  Honor,
  Student,
  UserSession,
  AppSettings
} from '../types';

interface NoticeAndSeatingViewProps {
  announcements: Announcement[];
  seating: SeatingLayout;
  honors: Honor[];
  students: Student[];
  user: UserSession | null;
  settings?: AppSettings;
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
  settings,
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

  // YÊU CẦU 2: Tab mặc định BẮT BUỘC là 'notices' (Bảng tin thông báo)
  const [activeSubTab, setActiveSubTab] = useState<'notices' | 'seating' | 'honors' | 'composer'>('notices');

  // Seating state
  const [localSeats, setLocalSeats] = useState<Seat[]>(seating.seats || []);
  const [isProjectorMode, setIsProjectorMode] = useState<boolean>(false);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [isSavingSeating, setIsSavingSeating] = useState<boolean>(false);
  const [draggedSeatCode, setDraggedSeatCode] = useState<string | null>(null);

  // Sync if seating props change
  useEffect(() => {
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

  // YÊU CẦU 3: Composer Form State with Attachments (Images, Videos, Links)
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [composerType, setComposerType] = useState<'announcement' | 'honor'>('announcement');
  const [compTitle, setCompTitle] = useState('');
  const [compContent, setCompContent] = useState('');
  const [compCategory, setCompCategory] = useState<'Chung' | 'Học tập' | 'Hoạt động' | 'Khẩn cấp'>('Chung');
  const [compIsPinned, setCompIsPinned] = useState(false);
  const [compStudentId, setCompStudentId] = useState('');
  const [compBadge, setCompBadge] = useState<Honor['badge']>('trophy');
  const [composerSuccess, setComposerSuccess] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Attachments State
  const [attachedImages, setAttachedImages] = useState<AnnouncementImage[]>([]);
  const [attachedVideos, setAttachedVideos] = useState<AnnouncementVideo[]>([]);
  const [attachedLinks, setAttachedLinks] = useState<AnnouncementLink[]>([]);

  // Link dialog input state
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState('');

  // Refs for file inputs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Lightbox Modal state for full-screen image view
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Handle uploading multiple images
  const handleImagesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const url = ev.target?.result as string;
        if (url) {
          setAttachedImages(prev => [
            ...prev,
            {
              id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              url,
              name: file.name
            }
          ]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Handle uploading multiple videos
  const handleVideosSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('video/')) {
        alert(`Tệp "${file.name}" không phải là định dạng video hợp lệ (MP4/WEBM).`);
        return;
      }
      // Check reasonable file size (< 50MB for in-browser buffer)
      if (file.size > 50 * 1024 * 1024) {
        alert(`Video "${file.name}" vượt quá dung lượng 50MB. Vui lòng chọn video có dung lượng nhỏ hơn hoặc liên kết qua Google Drive / YouTube.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = ev => {
        const url = ev.target?.result as string;
        if (url) {
          setAttachedVideos(prev => [
            ...prev,
            {
              id: `vid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              url,
              name: file.name,
              size: file.size
            }
          ]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  // Add Link handler
  const handleAddLink = () => {
    let cleanUrl = linkUrl.trim();
    if (!cleanUrl) {
      setLinkError('Vui lòng nhập đường dẫn liên kết');
      return;
    }
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    try {
      new URL(cleanUrl);
    } catch {
      setLinkError('Đường dẫn URL không hợp lệ');
      return;
    }

    const title = linkTitle.trim() || cleanUrl;
    setAttachedLinks(prev => [
      ...prev,
      {
        id: `lnk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title,
        url: cleanUrl
      }
    ]);

    setLinkTitle('');
    setLinkUrl('');
    setLinkError('');
    setShowLinkDialog(false);
  };

  // Reorder images
  const moveImage = (index: number, direction: 'left' | 'right') => {
    setAttachedImages(prev => {
      const copy = [...prev];
      const targetIdx = direction === 'left' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= copy.length) return prev;
      const tmp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = tmp;
      return copy;
    });
  };

  // Start editing existing announcement
  const handleStartEditAnnouncement = (ann: Announcement) => {
    setEditingAnnouncementId(ann.id);
    setComposerType('announcement');
    setCompTitle(ann.title);
    setCompContent(ann.content);
    setCompCategory(ann.category || 'Chung');
    setCompIsPinned(Boolean(ann.isPinned));
    setAttachedImages(ann.images || []);
    setAttachedVideos(ann.videos || []);
    setAttachedLinks(ann.links || []);
    setActiveSubTab('composer');
  };

  // Publish from Composer
  const handlePublishFromComposer = async (isDraft: boolean) => {
    if (!compTitle.trim()) return;
    setIsPublishing(true);

    try {
      if (composerType === 'announcement') {
        const payload: Partial<Announcement> = {
          title: compTitle.trim(),
          content: compContent.trim(),
          category: compCategory,
          isPinned: compIsPinned,
          isPublished: !isDraft,
          type: 'announcement',
          images: attachedImages,
          videos: attachedVideos,
          links: attachedLinks
        };

        if (editingAnnouncementId) {
          await onUpdateAnnouncement(editingAnnouncementId, payload);
          setEditingAnnouncementId(null);
        } else {
          await onCreateAnnouncement(payload);
        }
      } else {
        // Honor creation
        const selectedStudent = studentMap.get(compStudentId);
        await onCreateHonor({
          studentId: compStudentId,
          studentName: selectedStudent ? selectedStudent.name : 'Học sinh',
          title: compTitle.trim(),
          description: compContent.trim(),
          badge: compBadge,
          date: new Date().toISOString().substring(0, 10),
          isPublished: !isDraft
        });
      }

      setComposerSuccess(true);
      // Reset composer
      setCompTitle('');
      setCompContent('');
      setAttachedImages([]);
      setAttachedVideos([]);
      setAttachedLinks([]);
      setCompIsPinned(false);
      setEditingAnnouncementId(null);

      setTimeout(() => {
        setComposerSuccess(false);
        setActiveSubTab('notices');
      }, 900);
    } catch (err: any) {
      alert(`Lỗi khi đăng bài: ${err.message || err}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Sort announcements: Pinned first, then by date descending
  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [announcements]);

  return (
    <div className="space-y-6">
      {/* 1. TOP SUB-TAB NAVIGATION BAR (YÊU CẦU 2: Bảng tin -> Sơ đồ lớp -> Vinh danh -> Đăng thông tin) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-3xl border border-rose-100 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
          {/* TAB 1: BẢNG TIN THÔNG BÁO (Mặc định hàng đầu) */}
          <button
            onClick={() => setActiveSubTab('notices')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSubTab === 'notices'
                ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/60 ring-1 ring-rose-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/50'
            }`}
          >
            <Newspaper className="w-4 h-4 text-[#E06D85]" />
            <span>Bảng tin thông báo ({announcements.length})</span>
          </button>

          {/* TAB 2: SƠ ĐỒ LỚP */}
          <button
            onClick={() => setActiveSubTab('seating')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSubTab === 'seating'
                ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/60 ring-1 ring-rose-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/50'
            }`}
          >
            <Users className="w-4 h-4 text-[#E06D85]" />
            <span>Sơ đồ lớp</span>
          </button>

          {/* TAB 3: VINH DANH */}
          <button
            onClick={() => setActiveSubTab('honors')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeSubTab === 'honors'
                ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/60 ring-1 ring-rose-200/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/50'
            }`}
          >
            <Award className="w-4 h-4 text-[#E06D85]" />
            <span>Vinh danh ({honors.length})</span>
          </button>

          {/* TAB 4: ĐĂNG THÔNG TIN MỚI (Chỉ hiển thị cho giáo viên) */}
          {isTeacher && (
            <button
              onClick={() => {
                setEditingAnnouncementId(null);
                setCompTitle('');
                setCompContent('');
                setAttachedImages([]);
                setAttachedVideos([]);
                setAttachedLinks([]);
                setActiveSubTab('composer');
              }}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeSubTab === 'composer'
                  ? 'bg-rose-50 text-[#C94C67] shadow-xs border border-rose-200/60 ring-1 ring-rose-200/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/50'
              }`}
            >
              <Send className="w-4 h-4 text-[#E06D85]" />
              <span>Đăng thông tin mới</span>
            </button>
          )}
        </div>

        {/* Header Action controls */}
        {activeSubTab === 'seating' && (
          <div className="flex items-center gap-2 px-2">
            <button
              onClick={() => setIsProjectorMode(!isProjectorMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                isProjectorMode
                  ? 'bg-slate-900 text-white border-slate-800'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
              title="Chế độ chiếu máy chiếu (Full màn hình)"
            >
              {isProjectorMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isProjectorMode ? 'Thu nhỏ' : 'Chiếu máy chiếu'}</span>
            </button>

            {isTeacher && (
              <button
                onClick={handleSaveSeatingClick}
                disabled={isSavingSeating}
                className="px-4 py-1.5 rounded-xl bg-[#E06D85] hover:bg-[#C94C67] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingSeating ? 'Đang lưu...' : 'Lưu bố trí'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: BẢNG TIN THÔNG BÁO (HIỂN THỊ ĐẦU TIÊN)                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'notices' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl">
                Bảng tin thông báo lớp {settings?.className || '7A1'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cập nhật thông tin nề nếp, lịch học, phong trào và thông báo khẩn cấp từ giáo viên chủ nhiệm
              </p>
            </div>

            {isTeacher && (
              <button
                onClick={() => {
                  setEditingAnnouncementId(null);
                  setCompTitle('');
                  setCompContent('');
                  setAttachedImages([]);
                  setAttachedVideos([]);
                  setAttachedLinks([]);
                  setActiveSubTab('composer');
                }}
                className="px-4 py-2 rounded-2xl bg-[#E06D85] text-white text-xs font-bold hover:bg-[#C94C67] flex items-center gap-1.5 shadow-md shadow-rose-200/50 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Đăng thông báo</span>
              </button>
            )}
          </div>

          {/* Announcements List */}
          <div className="space-y-4">
            {sortedAnnouncements.map(ann => {
              const hasImages = Array.isArray(ann.images) && ann.images.length > 0;
              const hasVideos = Array.isArray(ann.videos) && ann.videos.length > 0;
              const hasLinks = Array.isArray(ann.links) && ann.links.length > 0;

              return (
                <div
                  key={ann.id}
                  className={`bg-white rounded-3xl p-5 sm:p-6 border transition-all ${
                    ann.isPinned
                      ? 'border-rose-300 shadow-md ring-1 ring-rose-200/40 bg-gradient-to-b from-[#FFFDFE] to-white'
                      : 'border-rose-100 shadow-xs hover:border-rose-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Meta badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {ann.isPinned && (
                          <span className="px-3 py-1 rounded-full bg-rose-100 text-[#C94C67] text-[11px] font-extrabold flex items-center gap-1.5 shadow-2xs">
                            <Pin className="w-3.5 h-3.5 fill-current" />
                            <span>ĐÃ GHIM ĐẦU BẢNG TIN</span>
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                          {ann.category || 'Chung'}
                        </span>
                        {!ann.isPublished && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                            Bản nháp
                          </span>
                        )}
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-400 tabular-nums">{ann.createdAt}</span>
                      </div>

                      {/* Title */}
                      <h4 className="font-extrabold text-slate-900 text-base sm:text-xl tracking-tight leading-snug">
                        {ann.title}
                      </h4>

                      {/* Content text */}
                      <div className="text-slate-700 text-xs sm:text-sm mt-2.5 whitespace-pre-line leading-relaxed">
                        {ann.content}
                      </div>

                      {/* YÊU CẦU 3: BỘ SƯU TẬP HÌNH ẢNH ĐÍNH KÈM */}
                      {hasImages && (
                        <div className="mt-4 pt-3 border-t border-rose-50">
                          <div className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4 text-[#E06D85]" />
                            <span>Hình ảnh đính kèm ({ann.images!.length}):</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                            {ann.images!.map((img, idx) => (
                              <div
                                key={img.id || idx}
                                onClick={() => setLightboxImageUrl(img.url)}
                                className="group relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 border border-rose-100 cursor-pointer shadow-2xs hover:shadow-md transition-all"
                              >
                                <img
                                  src={img.url}
                                  alt={img.name || `Ảnh ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* YÊU CẦU 3: CÁC VIDEO ĐÍNH KÈM VỚI TRÌNH PHÁT */}
                      {hasVideos && (
                        <div className="mt-4 pt-3 border-t border-rose-50">
                          <div className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                            <VideoIcon className="w-4 h-4 text-purple-600" />
                            <span>Video đính kèm ({ann.videos!.length}):</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {ann.videos!.map((vid, idx) => (
                              <div
                                key={vid.id || idx}
                                className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-sm"
                              >
                                <video
                                  src={vid.url}
                                  controls
                                  preload="metadata"
                                  className="w-full max-h-56 bg-black"
                                >
                                  Trình duyệt không hỗ trợ phát video này.
                                </video>
                                <div className="p-2.5 bg-slate-900 text-white flex items-center justify-between text-xs">
                                  <span className="font-semibold truncate max-w-[200px]">{vid.name}</span>
                                  {vid.size && (
                                    <span className="text-[11px] text-slate-400">
                                      {(vid.size / (1024 * 1024)).toFixed(1)} MB
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* YÊU CẦU 3: DANH SÁCH LIÊN KẾT ĐÍNH KÈM */}
                      {hasLinks && (
                        <div className="mt-4 pt-3 border-t border-rose-50">
                          <div className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                            <LinkIcon className="w-4 h-4 text-blue-600" />
                            <span>Liên kết liên quan ({ann.links!.length}):</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {ann.links!.map((lnk, idx) => (
                              <a
                                key={lnk.id || idx}
                                href={lnk.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50/70 hover:bg-blue-100 text-blue-800 border border-blue-200/80 text-xs font-bold transition-colors shadow-2xs group"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                <span className="truncate max-w-[260px]">{lnk.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Author & Footer info */}
                      <div className="mt-4 pt-3 border-t border-rose-50 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Người đăng: <strong className="text-slate-800">{ann.author || settings?.teacherName || 'Lê Thị Thắm'}</strong>
                        </span>
                        <span>{settings?.schoolName || 'TRƯỜNG THCS NGUYỄN HUỆ'}</span>
                      </div>
                    </div>

                    {/* Teacher Action Buttons */}
                    {isTeacher && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => onUpdateAnnouncement(ann.id, { isPinned: !ann.isPinned })}
                          title={ann.isPinned ? 'Bỏ ghim' : 'Ghim thông báo'}
                          className={`p-2 rounded-xl border text-xs transition-colors ${
                            ann.isPinned
                              ? 'bg-rose-100 text-rose-700 border-rose-200'
                              : 'text-slate-400 hover:bg-slate-100 border-slate-200'
                          }`}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStartEditAnnouncement(ann)}
                          title="Sửa thông báo"
                          className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50 text-xs transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Bạn chắc chắn muốn xóa thông báo "${ann.title}"?`)) {
                              onDeleteAnnouncement(ann.id);
                            }
                          }}
                          title="Xóa thông báo"
                          className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {announcements.length === 0 && (
              <div className="p-16 text-center text-sm text-slate-400 bg-white rounded-3xl border border-rose-100 shadow-xs">
                <Newspaper className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">Chưa có thông báo nào được đăng</p>
                <p className="text-xs text-slate-400 mt-1">Giáo viên có thể bấm "Đăng thông báo" để chia sẻ thông tin cho lớp.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: SƠ ĐỒ LỚP (BẢO TOÀN DỮ LIỆU & VỊ TRÍ BÀN GHẾ)                   */}
      {/* ========================================================================= */}
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 text-white shadow-md border-2 border-emerald-900/50">
              {/* Teacher podium/desk */}
              <div className="flex items-center gap-3 bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-700 order-2 sm:order-1">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                  GV
                </div>
                <div className="text-left">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Bàn giáo viên</div>
                  <div className="text-xs font-bold text-white">
                    {settings?.teacherName || 'Lê Thị Thắm'}
                  </div>
                </div>
              </div>

              {/* Main Blackboard */}
              <div className="text-center order-1 sm:order-2 flex-1">
                <div className="inline-block px-8 py-2 rounded-xl bg-emerald-950 border border-emerald-700/60 shadow-inner">
                  <span className="font-extrabold tracking-widest text-emerald-200 text-sm sm:text-base uppercase">
                    BẢNG LỚP HỌC (HƯỚNG NHÌN BỤC GIẢNG)
                  </span>
                </div>
              </div>

              {/* Door orientation label */}
              <div className="text-xs text-slate-400 order-3 sm:order-3">
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">Cửa ra vào →</span>
              </div>
            </div>

            {/* Seating Grid (4 Columns of 2-seat desks x 7 Rows) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-2">
              {[1, 2, 3, 4].map(col => (
                <div key={col} className="space-y-2">
                  <div className="text-center font-bold text-xs text-slate-600 bg-rose-50/70 py-1.5 rounded-xl border border-rose-100">
                    Dãy {col}
                  </div>
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6, 7].map(desk => {
                      const leftCode = `D${col}-B${desk}-T`;
                      const rightCode = `D${col}-B${desk}-P`;
                      const leftSeat = localSeats.find(s => s.seatCode === leftCode) || {
                        seatCode: leftCode,
                        row: col,
                        desk,
                        position: 'L',
                        studentId: null
                      };
                      const rightSeat = localSeats.find(s => s.seatCode === rightCode) || {
                        seatCode: rightCode,
                        row: col,
                        desk,
                        position: 'R',
                        studentId: null
                      };

                      const leftStudent = leftSeat.studentId ? studentMap.get(leftSeat.studentId) : null;
                      const rightStudent = rightSeat.studentId ? studentMap.get(rightSeat.studentId) : null;

                      return (
                        <div
                          key={desk}
                          className="p-2 rounded-2xl bg-white border border-rose-100 shadow-2xs hover:shadow-xs transition-shadow"
                        >
                          <div className="text-[10px] text-slate-400 font-mono mb-1 text-center">
                            Bàn {desk}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {/* Left Seat */}
                            <button
                              type="button"
                              onClick={() => isTeacher && setSelectedSeat(leftSeat)}
                              className={`p-2 rounded-xl text-left border transition-all text-xs flex flex-col justify-between min-h-[56px] ${
                                leftStudent
                                  ? leftStudent.gender === 'Nữ'
                                    ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                                    : 'bg-blue-50/80 border-blue-200 text-blue-900'
                                  : 'bg-slate-50 border-dashed border-slate-200 text-slate-400 hover:border-slate-300'
                              }`}
                            >
                              <span className="font-mono text-[9px] text-slate-400">Trái</span>
                              {leftStudent ? (
                                <span className="font-bold truncate text-[11px]">{leftStudent.name}</span>
                              ) : (
                                <span className="text-[10px] italic">Trống</span>
                              )}
                            </button>

                            {/* Right Seat */}
                            <button
                              type="button"
                              onClick={() => isTeacher && setSelectedSeat(rightSeat)}
                              className={`p-2 rounded-xl text-left border transition-all text-xs flex flex-col justify-between min-h-[56px] ${
                                rightStudent
                                  ? rightStudent.gender === 'Nữ'
                                    ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                                    : 'bg-blue-50/80 border-blue-200 text-blue-900'
                                  : 'bg-slate-50 border-dashed border-slate-200 text-slate-400 hover:border-slate-300'
                              }`}
                            >
                              <span className="font-mono text-[9px] text-slate-400">Phải</span>
                              {rightStudent ? (
                                <span className="font-bold truncate text-[11px]">{rightStudent.name}</span>
                              ) : (
                                <span className="text-[10px] italic">Trống</span>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: BẢNG VÀNG VINH DANH HỌC SINH                                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'honors' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl">
                Bảng vàng vinh danh lớp {settings?.className || '7A1'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tuyên dương những nỗ lực học tập, rèn luyện và thành tích xuất sắc của học sinh
              </p>
            </div>
            {isTeacher && (
              <button
                onClick={() => {
                  setComposerType('honor');
                  setActiveSubTab('composer');
                }}
                className="px-4 py-2 rounded-2xl bg-[#E06D85] text-white text-xs font-bold hover:bg-[#C94C67] flex items-center gap-1.5 shadow-md shadow-rose-200/50"
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
                className="bg-white rounded-3xl p-5 border border-rose-100 shadow-xs hover:shadow-md transition-all relative flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-200 text-amber-900 flex items-center justify-center shrink-0 shadow-2xs">
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
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-opacity"
                        title="Xóa vinh danh"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-3.5">
                    <button
                      onClick={() => onOpenStudentProfile(hon.studentId)}
                      className="text-base font-extrabold text-slate-900 hover:text-rose-700 transition-colors text-left"
                    >
                      {hon.studentName}
                    </button>
                    <div className="text-xs font-bold text-amber-700 mt-1">
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
              <div className="col-span-full p-16 text-center text-sm text-slate-400 bg-white rounded-3xl border border-rose-100">
                <Award className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700">Chưa có học sinh nào được ghi danh</p>
                <p className="text-xs text-slate-400 mt-1">Thầy cô có thể thêm các vinh danh gương sáng để khích lệ tinh thần học tập của lớp.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: ĐĂNG THÔNG TIN MỚI (YÊU CẦU 3: ĐÍNH KÈM ẢNH, VIDEO, LIÊN KẾT) */}
      {/* ========================================================================= */}
      {activeSubTab === 'composer' && isTeacher && (
        <div className="max-w-3xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-rose-100 shadow-md space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-rose-100">
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl">
                {editingAnnouncementId ? 'Chỉnh sửa thông báo' : 'Đăng thông tin lớp học'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Soạn thảo thông báo hoặc vinh danh với đầy đủ hình ảnh, video và liên kết
              </p>
            </div>

            {/* Type selector */}
            {!editingAnnouncementId && (
              <div className="flex items-center gap-1 bg-rose-50 p-1 rounded-2xl border border-rose-100">
                <button
                  type="button"
                  onClick={() => setComposerType('announcement')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    composerType === 'honor'
                      ? 'bg-white text-rose-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Khen thưởng vinh danh
                </button>
              </div>
            )}
          </div>

          {composerSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Đã lưu và công bố nội dung thành công!</span>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4 text-xs">
            {composerType === 'honor' && (
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Chọn học sinh được vinh danh *
                </label>
                <select
                  value={compStudentId}
                  onChange={e => setCompStudentId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-rose-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#E06D85]"
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
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {composerType === 'announcement' ? 'Tiêu đề thông báo *' : 'Tiêu đề thành tích / danh hiệu *'}
              </label>
              <input
                type="text"
                value={compTitle}
                onChange={e => setCompTitle(e.target.value)}
                placeholder={composerType === 'announcement' ? 'Ví dụ: Kế hoạch thi giữa kỳ môn Toán...' : 'Ví dụ: Đạt giải Nhất học sinh giỏi cấp Thành phố...'}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-rose-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#E06D85]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {composerType === 'announcement' ? (
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Chuyên mục
                  </label>
                  <select
                    value={compCategory}
                    onChange={e => setCompCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-rose-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#E06D85]"
                  >
                    <option value="Chung">Chung</option>
                    <option value="Học tập">Học tập</option>
                    <option value="Hoạt động">Hoạt động phong trào</option>
                    <option value="Khẩn cấp">Khẩn cấp / Quan trọng</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Biểu tượng vinh danh
                  </label>
                  <select
                    value={compBadge}
                    onChange={e => setCompBadge(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-rose-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#E06D85]"
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
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={compIsPinned}
                      onChange={e => setCompIsPinned(e.target.checked)}
                      className="rounded text-[#E06D85] focus:ring-[#E06D85] w-4 h-4"
                    />
                    <span>Ghim thông báo này lên đầu bảng tin</span>
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {composerType === 'announcement' ? 'Nội dung chi tiết *' : 'Lời chúc mừng và mô tả chi tiết'}
              </label>
              <textarea
                rows={5}
                value={compContent}
                onChange={e => setCompContent(e.target.value)}
                placeholder="Nhập nội dung đầy đủ của bài đăng..."
                className="w-full px-3.5 py-2.5 rounded-2xl border border-rose-200 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#E06D85]"
              />
            </div>

            {/* YÊU CẦU 3: KHU VỰC TỆP ĐÍNH KÈM & LIÊN KẾT */}
            {composerType === 'announcement' && (
              <div className="p-4 sm:p-5 rounded-3xl bg-[#FFF9FA] border border-rose-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#E06D85]" />
                      <span>TỆP ĐÍNH KÈM & LIÊN KẾT</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Thêm đồng thời nhiều hình ảnh, video và đường dẫn tài liệu vào cùng một bài đăng
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Hidden File Inputs */}
                    <input
                      type="file"
                      ref={imageInputRef}
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      className="hidden"
                      onChange={handleImagesSelected}
                    />
                    <input
                      type="file"
                      ref={videoInputRef}
                      multiple
                      accept="video/mp4,video/webm"
                      className="hidden"
                      onChange={handleVideosSelected}
                    />

                    {/* Button 1: Thêm hình ảnh */}
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-[#C94C67] hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-[#E06D85]" />
                      <span>+ Thêm hình ảnh</span>
                    </button>

                    {/* Button 2: Thêm video */}
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <VideoIcon className="w-3.5 h-3.5 text-purple-600" />
                      <span>+ Thêm video</span>
                    </button>

                    {/* Button 3: Thêm liên kết */}
                    <button
                      type="button"
                      onClick={() => {
                        setLinkTitle('');
                        setLinkUrl('');
                        setLinkError('');
                        setShowLinkDialog(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span>+ Thêm liên kết</span>
                    </button>
                  </div>
                </div>

                {/* Preview 1: Images Selected */}
                {attachedImages.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-rose-100">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Hình ảnh đã chọn ({attachedImages.length}):</span>
                      <button
                        type="button"
                        onClick={() => setAttachedImages([])}
                        className="text-[11px] text-red-600 hover:underline"
                      >
                        Xóa tất cả ảnh
                      </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                      {attachedImages.map((img, idx) => (
                        <div
                          key={img.id || idx}
                          className="relative aspect-square rounded-2xl overflow-hidden border border-rose-200 group bg-slate-100 shadow-2xs"
                        >
                          <img
                            src={img.url}
                            alt={img.name || `Ảnh ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1 right-1 flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => setAttachedImages(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1 rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors shadow-xs"
                              title="Xóa ảnh này"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between px-1 bg-black/50 rounded text-[9px] text-white">
                            <span>#{idx + 1}</span>
                            <div className="flex items-center">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => moveImage(idx, 'left')}
                                  className="hover:text-amber-300"
                                  title="Chuyển lên trước"
                                >
                                  ←
                                </button>
                              )}
                              {idx < attachedImages.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => moveImage(idx, 'right')}
                                  className="ml-1 hover:text-amber-300"
                                  title="Chuyển ra sau"
                                >
                                  →
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview 2: Videos Selected */}
                {attachedVideos.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-rose-100">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Video đã chọn ({attachedVideos.length}):</span>
                      <button
                        type="button"
                        onClick={() => setAttachedVideos([])}
                        className="text-[11px] text-red-600 hover:underline"
                      >
                        Xóa tất cả video
                      </button>
                    </div>
                    <div className="space-y-2">
                      {attachedVideos.map((vid, idx) => (
                        <div
                          key={vid.id || idx}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-purple-100 shadow-2xs gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                              <VideoIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 text-xs truncate max-w-xs sm:max-w-md">
                                {vid.name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {vid.size ? `${(vid.size / (1024 * 1024)).toFixed(1)} MB` : 'Đã sẵn sàng phát'}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAttachedVideos(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Xóa video"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview 3: Links Selected */}
                {attachedLinks.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-rose-100">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Liên kết đính kèm ({attachedLinks.length}):</span>
                      <button
                        type="button"
                        onClick={() => setAttachedLinks([])}
                        className="text-[11px] text-red-600 hover:underline"
                      >
                        Xóa tất cả link
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {attachedLinks.map((lnk, idx) => (
                        <div
                          key={lnk.id || idx}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-white border border-blue-100 shadow-2xs gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-blue-900 text-xs truncate">{lnk.title}</div>
                              <div className="text-[10px] text-slate-400 truncate max-w-xs">{lnk.url}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={lnk.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-bold"
                            >
                              Mở thử
                            </a>
                            <button
                              type="button"
                              onClick={() => setAttachedLinks(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                              title="Xóa link"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-rose-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => handlePublishFromComposer(true)}
              disabled={!compTitle.trim() || isPublishing}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Lưu bản nháp
            </button>

            <button
              type="button"
              onClick={() => handlePublishFromComposer(false)}
              disabled={!compTitle.trim() || (composerType === 'honor' && !compStudentId) || isPublishing}
              className="px-6 py-2.5 rounded-2xl bg-[#E06D85] hover:bg-[#C94C67] text-white text-xs font-extrabold transition-all shadow-md shadow-rose-200 flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isPublishing ? 'Đang đăng bài...' : 'Đăng công bố ngay'}</span>
            </button>
          </div>
        </div>
      )}

      {/* DIALOG THÊM LIÊN KẾT */}
      {showLinkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-rose-100">
              <h4 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-blue-600" />
                <span>Thêm liên kết tài liệu</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowLinkDialog(false)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {linkError && (
              <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>{linkError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên liên kết (Tiêu đề hiển thị)
                </label>
                <input
                  type="text"
                  value={linkTitle}
                  onChange={e => setLinkTitle(e.target.value)}
                  placeholder="Ví dụ: Link Padlet nộp bài tập / Form khảo sát"
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm focus:ring-2 focus:ring-[#E06D85]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Đường dẫn URL *
                </label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://drive.google.com/... hoặc https://youtube.com/..."
                  className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm font-mono focus:ring-2 focus:ring-[#E06D85]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLinkDialog(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Thêm liên kết
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL (Xem ảnh kích thước lớn) */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImageUrl(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-rose-300"
              title="Đóng xem ảnh"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxImageUrl}
              alt="Ảnh phóng to"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
              onClick={e => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* MODAL GÁN HỌC SINH VÀO CHỖ NGỒI (Teacher Only) */}
      {selectedSeat && isTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-rose-100">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">
                  Xếp chỗ ngồi: {selectedSeat.seatCode}
                </h4>
                <p className="text-[11px] text-slate-400">
                  Dãy {selectedSeat.row} · Bàn {selectedSeat.desk} · Vị trí {selectedSeat.position === 'L' ? 'Trái' : 'Phải'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSeat(null)}
                className="p-1 rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-slate-700">Chọn học sinh xếp vào vị trí này:</label>
              <select
                defaultValue={selectedSeat.studentId || ''}
                onChange={e => handleAssignStudent(selectedSeat.seatCode, e.target.value || null)}
                className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
              >
                <option value="">-- Để trống chỗ này --</option>
                {students.map(s => {
                  const isAssignedElsewhere = assignedStudentIds.has(s.id) && s.id !== selectedSeat.studentId;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name} ({s.gender}) {isAssignedElsewhere ? '⚠️ Đã có chỗ' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedSeat(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
