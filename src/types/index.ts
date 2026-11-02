export type Role = 'teacher' | 'student';

export interface UserSession {
  id: string;
  username: string;
  role: Role;
  name: string;
  studentId?: string; // If role === 'student'
}

export interface Student {
  id: string; // Internal unique ID or matches code
  code: string; // Mã học sinh (e.g. HS01, 2026001)
  name: string; // Họ và tên
  gender: 'Nam' | 'Nữ'; // Giới tính
  dob: string; // Ngày sinh DD/MM/YYYY
  phone: string; // Số điện thoại liên hệ
  address?: string;
  parentName?: string;
  parentPhone?: string;
  notes?: string;
  passwordHash?: string;
  passwordSalt?: string;
  customPasswordSet?: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  createdAt: string; // YYYY-MM-DD HH:mm
  isPinned: boolean;
  isPublished: boolean;
  category: 'Chung' | 'Học tập' | 'Hoạt động' | 'Khẩn cấp';
  attachmentName?: string;
}

export interface Seat {
  seatCode: string; // e.g., "D1-B1-T", "D4-B7-P"
  row: number; // 1 to 4 (Dãy 1 đến Dãy 4)
  desk: number; // 1 to 7 (Bàn 1 đến Bàn 7)
  position: 'L' | 'R'; // Trái | Phải (T | P)
  studentId: string | null;
}

export interface SeatingLayout {
  seats: Seat[];
  updatedAt: string;
}

export interface Honor {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  description: string;
  badge: 'trophy' | 'medal' | 'star' | 'lotus' | 'heart' | 'ribbon';
  date: string;
  isPublished: boolean;
}

export type AttendanceStatus = 'present' | 'excused_absence' | 'unexcused_absence' | 'late';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  note?: string;
  linkedConductId?: string; // If auto-synced from conduct event
}

export type AssessmentType = 'TX1' | 'TX2' | 'TX3' | 'GK' | 'CK';

export interface Subject {
  id: string;
  code: string;
  name: string;
  type: 'score' | 'qualitative'; // Cho điểm (0-10) hoặc Nhận xét (Đạt/Chưa đạt)
  isActive: boolean;
  order: number;
}

export interface GradeRecord {
  id: string;
  studentId: string;
  studentName?: string;
  subjectId: string;
  semester: 'HK1' | 'HK2';
  assessmentType: AssessmentType;
  score?: number; // 0 to 10
  qualitativeRating?: 'Đạt' | 'Chưa đạt' | 'Tốt' | 'Hoàn thành tốt' | 'Hoàn thành';
  note?: string;
  date: string; // YYYY-MM-DD
}

export interface ConductRule {
  id: string;
  code: string;
  name: string;
  points: number; // e.g. +5, -3
  category: 'Học tập' | 'Nề nếp' | 'Chuyên cần' | 'Hoạt động phong trào';
  note?: string;
  linkAttendance?: boolean;
  attendanceStatus?: AttendanceStatus;
}

export interface ConductLog {
  id: string;
  studentId: string;
  studentName: string;
  ruleId?: string;
  ruleCode?: string;
  ruleName: string;
  points: number; // Snapshotted at creation
  date: string; // YYYY-MM-DD
  note?: string;
  syncedAttendanceId?: string;
}

export interface EvaluationTier {
  rating: 'Tốt' | 'Khá' | 'Đạt' | 'Cần rèn luyện';
  minScore: number;
}

export interface PeriodEvaluation {
  studentId: string;
  period: string; // e.g., "2026-11", "HK1", "HK2", "ALL"
  totalScore: number;
  calculatedRating: 'Tốt' | 'Khá' | 'Đạt' | 'Cần rèn luyện';
  confirmedRating?: 'Tốt' | 'Khá' | 'Đạt' | 'Cần rèn luyện';
  reason?: string;
  updatedAt?: string;
}

export interface AppSettings {
  appName: string;
  schoolName: string;
  className: string;
  teacherName: string;
  schoolYear: string;
  baseConductScore: number; // Điểm khởi tạo kỳ đánh giá (mặc định 100 hoặc 0)
  accentColor: string;
  conductRules: ConductRule[];
  evaluationTiers: EvaluationTier[];
  subjects: Subject[];
}
