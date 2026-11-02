import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Detect Serverless environment (Vercel / Lambda)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? path.join('/tmp', 'gvcn_data') : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Supabase configuration for project thuy-trang
const SUPABASE_PROJECT_NAME = 'thuy-trang';
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  !supabaseUrl.includes('your-project-id') &&
  supabaseKey
);

const supabaseServer: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Middleware for parsing JSON requests
app.use(express.json({ limit: '10mb' }));

// Vercel Serverless Routing normalizer:
// Ensure Express router always sees /api/... even if Vercel rewrites stripped the prefix or passed relative paths
app.use((req: any, _res: any, next: any) => {
  const original = req.originalUrl || '';
  if (original && (original.startsWith('/api') || original.startsWith('/supabase'))) {
    req.url = original;
  } else if (!req.url.startsWith('/api') && !req.url.startsWith('/supabase')) {
    const knownPrefixes = ['/auth', '/students', '/settings', '/attendance', '/grades', '/conduct', '/seating', '/honors', '/announcements', '/evaluations'];
    if (knownPrefixes.some(p => req.url.startsWith(p))) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
  }
  next();
});

// Ensure data directory exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not initialize DATA_DIR:', e);
}

// Password hashing helper (PBKDF2)
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return checkHash === hash;
}

// Format DOB to DDMMYYYY for default student password
function formatDobToPasswordSuffix(dob: string): string {
  // input could be "15/03/2009" or "15-03-2009" or "2009-03-15"
  const cleaned = dob.trim();
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${d}${m}${y}`;
    }
  } else if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return `${parts[2].padStart(2, '0')}${parts[1].padStart(2, '0')}${parts[0]}`;
      } else {
        // DD-MM-YYYY
        return `${parts[0].padStart(2, '0')}${parts[1].padStart(2, '0')}${parts[2]}`;
      }
    }
  }
  return cleaned.replace(/\D/g, '');
}

// Token store for session verification (supports both in-memory and HMAC signed stateless tokens for Vercel Serverless)
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'gvcn-secret-salt-2026';
const sessions = new Map<string, { userId: string; role: 'teacher' | 'student'; username: string; name: string; studentId?: string; expiresAt: number }>();

function generateToken(payload: { userId: string; role: 'teacher' | 'student'; username: string; name: string; studentId?: string }): string {
  const data = {
    ...payload,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  const jsonStr = JSON.stringify(data);
  const base64Data = Buffer.from(jsonStr).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(base64Data).digest('base64url');
  const token = `${base64Data}.${signature}`;
  sessions.set(token, data);
  return token;
}

function verifyToken(token: string): { userId: string; role: 'teacher' | 'student'; username: string; name: string; studentId?: string; expiresAt: number } | null {
  if (!token) return null;
  // 1. Verify signed token structure (Stateless across Vercel serverless function instances)
  if (token.includes('.')) {
    const [base64Data, signature] = token.split('.');
    if (base64Data && signature) {
      const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(base64Data).digest('base64url');
      if (expectedSig === signature) {
        try {
          const data = JSON.parse(Buffer.from(base64Data, 'base64url').toString('utf-8'));
          if (data && data.expiresAt && data.expiresAt > Date.now()) {
            return data;
          }
        } catch {}
      }
    }
  }
  // 2. Fallback to in-memory session map
  const mem = sessions.get(token);
  if (mem && mem.expiresAt > Date.now()) {
    return mem;
  }
  return null;
}

// Initial Mock Seed Data
function getInitialData() {
  const teacherCreds = hashPassword('Gvcn@2026');

  const initialStudentsRaw = [
    { code: 'HS01', name: 'Nguyễn Văn An', gender: 'Nam', dob: '12/03/2009', phone: '0912345601', address: '12 Đường Lê Lợi, P. Bến Nghé, Q.1' },
    { code: 'HS02', name: 'Trần Thị Bích Ngọc', gender: 'Nữ', dob: '05/07/2009', phone: '0912345602', address: '45 Đường Nguyễn Huệ, P. Bến Nghé, Q.1' },
    { code: 'HS03', name: 'Lê Hoàng Cường', gender: 'Nam', dob: '22/01/2009', phone: '0912345603', address: '88 Đường Pasteur, P. Võ Thị Sáu, Q.3' },
    { code: 'HS04', name: 'Phạm Thu Dung', gender: 'Nữ', dob: '18/09/2009', phone: '0912345604', address: '102 Đường Hai Bà Trưng, P. Tân Định, Q.1' },
    { code: 'HS05', name: 'Vũ Đức Duy', gender: 'Nam', dob: '30/11/2009', phone: '0912345605', address: '15 Điện Biên Phủ, P. Đa Kao, Q.1' },
    { code: 'HS06', name: 'Đỗ Thảo Hương', gender: 'Nữ', dob: '14/04/2009', phone: '0912345606', address: '27 CMT8, P. Bến Thành, Q.1' },
    { code: 'HS07', name: 'Hoàng Minh Khôi', gender: 'Nam', dob: '08/08/2009', phone: '0912345607', address: '63 Nam Kỳ Khởi Nghĩa, Q.1' },
    { code: 'HS08', name: 'Bùi Lan Anh', gender: 'Nữ', dob: '25/02/2009', phone: '0912345608', address: '19 Nguyễn Thị Minh Khai, Q.1' },
    { code: 'HS09', name: 'Đặng Tuấn Kiệt', gender: 'Nam', dob: '11/12/2009', phone: '0912345609', address: '50 Đinh Tiên Hoàng, Q.1' },
    { code: 'HS10', name: 'Ngô Mỹ Linh', gender: 'Nữ', dob: '03/06/2009', phone: '0912345610', address: '78 Võ Văn Tần, Q.3' },
    { code: 'HS11', name: 'Phan Quốc Long', gender: 'Nam', dob: '19/10/2009', phone: '0912345611', address: '33 Trần Hưng Đạo, Q.5' },
    { code: 'HS12', name: 'Dương Khánh Mai', gender: 'Nữ', dob: '28/05/2009', phone: '0912345612', address: '42 Nguyễn Trãi, Q.5' },
    { code: 'HS13', name: 'Lý Trọng Nhân', gender: 'Nam', dob: '17/04/2009', phone: '0912345613', address: '111 An Dương Vương, Q.5' },
    { code: 'HS14', name: 'Mai Trúc Phương', gender: 'Nữ', dob: '09/01/2009', phone: '0912345614', address: '85 Hùng Vương, Q.5' },
    { code: 'HS15', name: 'Hồ Bảo Quân', gender: 'Nam', dob: '21/07/2009', phone: '0912345615', address: '96 Lý Thường Kiệt, Q.10' },
    { code: 'HS16', name: 'Võ Thanh Tâm', gender: 'Nữ', dob: '13/03/2009', phone: '0912345616', address: '14 Sư Vạn Hạnh, Q.10' },
    { code: 'HS17', name: 'Đinh Tiến Thắng', gender: 'Nam', dob: '02/11/2009', phone: '0912345617', address: '58 Ba Tháng Hai, Q.10' },
    { code: 'HS18', name: 'Trịnh Kiều Trang', gender: 'Nữ', dob: '26/08/2009', phone: '0912345618', address: '22 Tô Hiến Thành, Q.10' },
    { code: 'HS19', name: 'Lâm Tuấn Tú', gender: 'Nam', dob: '07/05/2009', phone: '0912345619', address: '39 Cách Mạng Tháng 8, Q.3' },
    { code: 'HS20', name: 'Đoàn Yến Vy', gender: 'Nữ', dob: '16/09/2009', phone: '0912345620', address: '71 Nguyễn Thông, Q.3' },
    { code: 'HS21', name: 'Chu Bảo Nam', gender: 'Nam', dob: '29/04/2009', phone: '0912345621', address: '104 Lê Văn Sỹ, Q.3' },
    { code: 'HS22', name: 'Tạ Minh Châu', gender: 'Nữ', dob: '04/10/2009', phone: '0912345622', address: '18 Kỳ Đồng, Q.3' },
    { code: 'HS23', name: 'Quách Hữu Phước', gender: 'Nam', dob: '10/02/2009', phone: '0912345623', address: '62 Hoàng Sa, Q.1' },
    { code: 'HS24', name: 'Lương Nhã Uyên', gender: 'Nữ', dob: '23/12/2009', phone: '0912345624', address: '83 Trường Sa, Q. Bình Thạnh' },
    { code: 'HS25', name: 'Diệp Quang Vinh', gender: 'Nam', dob: '15/06/2009', phone: '0912345625', address: '29 Phan Đăng Lưu, Q. Bình Thạnh' },
    { code: 'HS26', name: 'Kim Hồng Phúc', gender: 'Nam', dob: '01/08/2009', phone: '0912345626', address: '46 Bạch Đằng, Q. Bình Thạnh' },
    { code: 'HS27', name: 'Vương Bảo Ngọc', gender: 'Nữ', dob: '19/05/2009', phone: '0912345627', address: '55 Nơ Trang Long, Q. Bình Thạnh' },
    { code: 'HS28', name: 'Thạch Hải Đăng', gender: 'Nam', dob: '24/09/2009', phone: '0912345628', address: '37 Ung Văn Khiêm, Q. Bình Thạnh' },
    { code: 'HS29', name: 'Châu Cẩm Tú', gender: 'Nữ', dob: '06/03/2009', phone: '0912345629', address: '12 Xô Viết Nghệ Tĩnh, Q. Bình Thạnh' },
    { code: 'HS30', name: 'La Chí Kiên', gender: 'Nam', dob: '31/07/2009', phone: '0912345630', address: '98 D2, Q. Bình Thạnh' }
  ];

  const students = initialStudentsRaw.map((s) => {
    const rawDefaultPass = `${s.code}${formatDobToPasswordSuffix(s.dob)}`;
    const cred = hashPassword(rawDefaultPass);
    return {
      id: s.code,
      code: s.code,
      name: s.name,
      gender: s.gender as 'Nam' | 'Nữ',
      dob: s.dob,
      phone: s.phone,
      address: s.address,
      passwordHash: cred.hash,
      passwordSalt: cred.salt,
      customPasswordSet: false,
      createdAt: new Date().toISOString()
    };
  });

  // 56 Seats (4 rows/dãy x 7 desks/bàn x 2 positions L/R)
  const seats: Array<{ seatCode: string; row: number; desk: number; position: 'L' | 'R'; studentId: string | null }> = [];
  let studentIdx = 0;
  for (let r = 1; r <= 4; r++) {
    for (let d = 1; d <= 7; d++) {
      for (const pos of ['L', 'R'] as const) {
        const seatCode = `D${r}-B${d}-${pos === 'L' ? 'T' : 'P'}`;
        const assignedStudent = studentIdx < students.length ? students[studentIdx].id : null;
        studentIdx++;
        seats.push({
          seatCode,
          row: r,
          desk: d,
          position: pos,
          studentId: assignedStudent
        });
      }
    }
  }

  const initialAnnouncements = [
    {
      id: 'ann-1',
      title: 'Kế hoạch học tập và sinh hoạt tuần 10 - Năm học 2025-2026',
      content: 'Chào cả lớp! Tuần này lớp chúng ta sẽ có đợt kiểm tra giữa kỳ môn Toán và Ngữ văn vào thứ 4 và thứ 5. Đề nghị các bạn ôn tập kỹ các chuyên đề trọng tâm theo hướng dẫn của thầy cô bộ môn. Thứ 7 toàn trường tham gia hoạt động ngoại khóa tìm hiểu lịch sử địa phương.',
      author: 'Cô Nguyễn Thị Mai (GVCN)',
      createdAt: '2026-10-28 08:30',
      isPinned: true,
      isPublished: true,
      category: 'Học tập'
    },
    {
      id: 'ann-2',
      title: 'Thông báo nộp phiếu đăng ký tham gia CLB Kỹ năng & Thể thao',
      content: 'Các bạn học sinh chú ý hạn chót nộp phiếu đăng ký câu lạc bộ là 17h00 thứ 6 tuần này tại bàn cán sự lớp (bạn Bích Ngọc). Mỗi bạn chọn ít nhất 01 CLB để rèn luyện kỹ năng và tính điểm thi đua phong trào.',
      author: 'Cô Nguyễn Thị Mai (GVCN)',
      createdAt: '2026-10-25 14:15',
      isPinned: false,
      isPublished: true,
      category: 'Hoạt động'
    },
    {
      id: 'ann-3',
      title: 'Nhắc nhở nề nếp tác phong và mặc đồng phục đúng quy định',
      content: 'Ban thi đua nhà trường đã kiểm tra nề nếp đầu tuần. Đa số các bạn chấp hành tốt, riêng một số bạn chú ý mang thẻ học sinh và không đi xe máy khi chưa đủ tuổi.',
      author: 'Cô Nguyễn Thị Mai (GVCN)',
      createdAt: '2026-10-20 07:15',
      isPinned: false,
      isPublished: true,
      category: 'Nề nếp'
    }
  ];

  const initialHonors = [
    {
      id: 'hon-1',
      studentId: 'HS02',
      studentName: 'Trần Thị Bích Ngọc',
      title: 'Giải Nhất Hội thi Hùng biện Tiếng Anh cấp Trường',
      description: 'Xuất sắc đạt số điểm tuyệt đối 98/100, thể hiện bản lĩnh tự tin và kiến thức xã hội sâu sắc.',
      badge: 'trophy' as const,
      date: '2026-10-24',
      isPublished: true
    },
    {
      id: 'hon-2',
      studentId: 'HS01',
      studentName: 'Nguyễn Văn An',
      title: 'Học sinh tiêu biểu tháng 10 - Gương sáng chuyên cần',
      description: 'Đạt điểm 10 kiểm tra môn Toán, tích cực giúp đỡ các bạn trong giờ sinh hoạt nhóm.',
      badge: 'star' as const,
      date: '2026-10-26',
      isPublished: true
    },
    {
      id: 'hon-3',
      studentId: 'HS10',
      studentName: 'Ngô Mỹ Linh',
      title: 'Huy chương Bạc Giải Cầu lông Học sinh TP',
      description: 'Thi đấu kiên cường, mang lại niềm tự hào cho tập thể lớp 7A1.',
      badge: 'medal' as const,
      date: '2026-10-18',
      isPublished: true
    }
  ];

  const conductRules = [
    { id: 'R01', code: 'TC-01', name: 'Đạt điểm 9-10 kiểm tra hoặc phát biểu xuất sắc', points: 5, category: 'Học tập' as const },
    { id: 'R02', code: 'TC-02', name: 'Tích cực tham gia vệ sinh lớp, giữ gìn tài sản chung', points: 3, category: 'Nề nếp' as const },
    { id: 'R03', code: 'TC-03', name: 'Tham gia đội tuyển học sinh giỏi hoặc thi đấu thể thao', points: 10, category: 'Hoạt động phong trào' as const },
    { id: 'R04', code: 'TC-04', name: 'Giúp đỡ bạn tiến bộ trong học tập', points: 5, category: 'Học tập' as const },
    { id: 'R05', code: 'TR-01', name: 'Đi học muộn', points: -2, category: 'Chuyên cần' as const, linkAttendance: true, attendanceStatus: 'late' as const },
    { id: 'R06', code: 'TR-02', name: 'Nghỉ học không phép', points: -5, category: 'Chuyên cần' as const, linkAttendance: true, attendanceStatus: 'unexcused_absence' as const },
    { id: 'R07', code: 'TR-03', name: 'Không chuẩn bị bài / không làm bài tập về nhà', points: -3, category: 'Học tập' as const },
    { id: 'R08', code: 'TR-04', name: 'Vi phạm đồng phục / tác phong', points: -2, category: 'Nề nếp' as const },
    { id: 'R09', code: 'TR-05', name: 'Làm mất trật tự trong giờ học', points: -3, category: 'Nề nếp' as const }
  ];

  const subjects = [
    { id: 'SUB-TOAN', code: 'TOAN', name: 'Toán học', type: 'score' as const, isActive: true, order: 1 },
    { id: 'SUB-VAN', code: 'VAN', name: 'Ngữ văn', type: 'score' as const, isActive: true, order: 2 },
    { id: 'SUB-ANH', code: 'ANH', name: 'Tiếng Anh', type: 'score' as const, isActive: true, order: 3 },
    { id: 'SUB-LY', code: 'LY', name: 'Vật lí', type: 'score' as const, isActive: true, order: 4 },
    { id: 'SUB-HOA', code: 'HOA', name: 'Hóa học', type: 'score' as const, isActive: true, order: 5 },
    { id: 'SUB-SINH', code: 'SINH', name: 'Sinh học', type: 'score' as const, isActive: true, order: 6 },
    { id: 'SUB-SU', code: 'SU', name: 'Lịch sử', type: 'score' as const, isActive: true, order: 7 },
    { id: 'SUB-DIA', code: 'DIA', name: 'Địa lí', type: 'score' as const, isActive: true, order: 8 },
    { id: 'SUB-GDCD', code: 'GDCD', name: 'Giáo dục kinh tế & pháp luật', type: 'score' as const, isActive: true, order: 9 },
    { id: 'SUB-TIN', code: 'TIN', name: 'Tin học', type: 'score' as const, isActive: true, order: 10 },
    { id: 'SUB-TD', code: 'TD', name: 'Giáo dục thể chất', type: 'qualitative' as const, isActive: true, order: 11 },
    { id: 'SUB-HDTN', code: 'HDTN', name: 'Hoạt động trải nghiệm, hướng nghiệp', type: 'qualitative' as const, isActive: true, order: 12 }
  ];

  const initialConductLogs = [
    { id: 'log-1', studentId: 'HS01', studentName: 'Nguyễn Văn An', ruleId: 'R01', ruleCode: 'TC-01', ruleName: 'Đạt điểm 9-10 kiểm tra hoặc phát biểu xuất sắc', points: 5, date: '2026-10-29', note: 'Điểm 10 kiểm tra 15p Toán' },
    { id: 'log-2', studentId: 'HS02', studentName: 'Trần Thị Bích Ngọc', ruleId: 'R03', ruleCode: 'TC-03', ruleName: 'Tham gia đội tuyển học sinh giỏi hoặc thi đấu thể thao', points: 10, date: '2026-10-24', note: 'Giải nhất Hùng biện TA' },
    { id: 'log-3', studentId: 'HS05', studentName: 'Vũ Đức Duy', ruleId: 'R05', ruleCode: 'TR-01', ruleName: 'Đi học muộn', points: -2, date: '2026-10-27', note: 'Đến trường lúc 7h15' },
    { id: 'log-4', studentId: 'HS09', studentName: 'Đặng Tuấn Kiệt', ruleId: 'R07', ruleCode: 'TR-03', ruleName: 'Không chuẩn bị bài / không làm bài tập về nhà', points: -3, date: '2026-10-28', note: 'Chưa làm bài tập Vật lí' },
    { id: 'log-5', studentId: 'HS03', studentName: 'Lê Hoàng Cường', ruleId: 'R02', ruleCode: 'TC-02', ruleName: 'Tích cực tham gia vệ sinh lớp, giữ gìn tài sản chung', points: 3, date: '2026-10-30', note: 'Trực nhật xuất sắc' }
  ];

  const initialAttendance = [
    { id: 'att-1', studentId: 'HS05', date: '2026-10-27', status: 'late', note: 'Tự động từ vi phạm Đi học muộn', linkedConductId: 'log-3' },
    { id: 'att-2', studentId: 'HS09', date: '2026-10-31', status: 'excused_absence', note: 'Gia đình có đơn xin phép nghỉ ốm' }
  ];

  const initialGrades = [
    { id: 'gr-1', studentId: 'HS01', subjectId: 'SUB-TOAN', semester: 'HK1', assessmentType: 'TX1', score: 9.5, date: '2026-10-15', note: 'Kiểm tra miệng' },
    { id: 'gr-2', studentId: 'HS01', subjectId: 'SUB-TOAN', semester: 'HK1', assessmentType: 'TX2', score: 10.0, date: '2026-10-28', note: 'Kiểm tra 15 phút' },
    { id: 'gr-3', studentId: 'HS01', subjectId: 'SUB-VAN', semester: 'HK1', assessmentType: 'TX1', score: 8.0, date: '2026-10-18', note: 'Phát biểu và bài viết ngắn' },
    { id: 'gr-4', studentId: 'HS02', subjectId: 'SUB-ANH', semester: 'HK1', assessmentType: 'TX1', score: 9.8, date: '2026-10-14', note: 'Thuyết trình' },
    { id: 'gr-5', studentId: 'HS02', subjectId: 'SUB-TOAN', semester: 'HK1', assessmentType: 'TX1', score: 8.5, date: '2026-10-15', note: 'Kiểm tra miệng' }
  ];

  return {
    teacher: {
      id: 'teacher-main',
      username: 'gvcn',
      name: 'Cô Lê Thị Thắm',
      role: 'teacher',
      passwordHash: teacherCreds.hash,
      passwordSalt: teacherCreds.salt
    },
    students,
    seating: {
      seats,
      updatedAt: new Date().toISOString()
    },
    announcements: initialAnnouncements,
    honors: initialHonors,
    conductRules,
    conductLogs: initialConductLogs,
    attendance: initialAttendance,
    grades: initialGrades,
    periodEvaluations: {},
    settings: {
      appName: 'GVCN – Lê Thị Thắm',
      schoolName: 'THPT Chuyên Lê Hồng Phong',
      className: '7A1',
      teacherName: 'Cô Lê Thị Thắm',
      schoolYear: '2025 - 2026',
      baseConductScore: 100,
      accentColor: '#E06D85',
      conductRules,
      evaluationTiers: [
        { rating: 'Tốt', minScore: 90 },
        { rating: 'Khá', minScore: 75 },
        { rating: 'Đạt', minScore: 60 },
        { rating: 'Cần rèn luyện', minScore: 0 }
      ],
      subjects
    }
  };
}

// Load DB with safe fallback for Vercel Serverless environment
function loadDb(): any {
  if (!fs.existsSync(DB_FILE)) {
    let initial: any = null;
    const localDbPath = path.join(__dirname, 'data', 'db.json');
    if (fs.existsSync(localDbPath)) {
      try {
        initial = JSON.parse(fs.readFileSync(localDbPath, 'utf-8'));
      } catch {}
    }
    if (!initial) {
      initial = getInitialData();
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Notice: Could not write DB_FILE to filesystem:', err);
    }
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading DB, using initial:', err);
    return getInitialData();
  }
}

// Atomic Save DB (handles serverless writable /tmp and catches disk errors)
function saveDb(data: any): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = path.join(DATA_DIR, `db.tmp.${Date.now()}`);
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.warn('Warning: Could not save DB to disk in current runtime:', err);
  }
}

// Authentication Middleware (supports stateless signed tokens across Vercel function instances)
function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Chưa đăng nhập hoặc thiếu token xác thực' });
  }
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const session = verifyToken(token);
  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' });
  }
  req.user = session;
  next();
}

function requireTeacher(req: any, res: any, next: any) {
  if (req.user?.role !== 'teacher') {
    return res.status(403).json({ error: 'Chỉ giáo viên chủ nhiệm mới có quyền thực hiện thao tác này' });
  }
  next();
}

// API Routes

// 1. Auth Me
app.get('/api/auth/me', authMiddleware, (req: any, res: any) => {
  const db = loadDb();
  if (req.user.role === 'teacher') {
    return res.json({
      user: {
        id: db.teacher.id,
        username: db.teacher.username,
        name: db.teacher.name,
        role: 'teacher'
      },
      settings: db.settings
    });
  } else {
    const student = db.students.find((s: any) => s.id === req.user.studentId || s.code === req.user.studentId);
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy hồ sơ học sinh' });
    }
    return res.json({
      user: {
        id: student.id,
        username: student.code,
        name: student.name,
        role: 'student',
        studentId: student.id
      },
      settings: {
        appName: db.settings.appName,
        schoolName: db.settings.schoolName,
        className: db.settings.className,
        teacherName: db.settings.teacherName,
        schoolYear: db.settings.schoolYear,
        accentColor: db.settings.accentColor
      }
    });
  }
});

// 2. Auth Login
app.post('/api/auth/login', (req: any, res: any) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu' });
  }
  const db = loadDb();
  const cleanUser = username.trim().toLowerCase();

  // Check Teacher login
  if (cleanUser === db.teacher.username.toLowerCase() || cleanUser === 'admin') {
    if (verifyPassword(password, db.teacher.passwordHash, db.teacher.passwordSalt)) {
      const token = generateToken({
        userId: db.teacher.id,
        role: 'teacher',
        username: db.teacher.username,
        name: db.teacher.name
      });
      return res.json({
        token,
        user: {
          id: db.teacher.id,
          username: db.teacher.username,
          name: db.teacher.name,
          role: 'teacher'
        }
      });
    }
  }

  // Check Student login
  const student = db.students.find(
    (s: any) => s.code.toLowerCase() === cleanUser || s.id.toLowerCase() === cleanUser
  );

  if (student) {
    let isValid = false;
    if (student.passwordHash && student.passwordSalt) {
      isValid = verifyPassword(password, student.passwordHash, student.passwordSalt);
    }
    // Also allow default MSDDMMYYYY if not verified yet
    if (!isValid) {
      const defaultPass = `${student.code}${formatDobToPasswordSuffix(student.dob)}`;
      if (password === defaultPass) {
        isValid = true;
        // Hash and save it
        const cred = hashPassword(password);
        student.passwordHash = cred.hash;
        student.passwordSalt = cred.salt;
        saveDb(db);
      }
    }

    if (isValid) {
      const token = generateToken({
        userId: student.id,
        role: 'student',
        username: student.code,
        name: student.name,
        studentId: student.id
      });
      return res.json({
        token,
        user: {
          id: student.id,
          username: student.code,
          name: student.name,
          role: 'student',
          studentId: student.id
        }
      });
    }
  }

  return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
});

// 3. Change Password
app.post('/api/auth/change-password', authMiddleware, (req: any, res: any) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Vui lòng cung cấp mật khẩu hiện tại và mật khẩu mới' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }

  const db = loadDb();
  if (req.user.role === 'teacher') {
    if (!verifyPassword(currentPassword, db.teacher.passwordHash, db.teacher.passwordSalt)) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác' });
    }
    const newCred = hashPassword(newPassword);
    db.teacher.passwordHash = newCred.hash;
    db.teacher.passwordSalt = newCred.salt;
    saveDb(db);
    return res.json({ success: true, message: 'Đổi mật khẩu giáo viên thành công' });
  } else {
    const student = db.students.find((s: any) => s.id === req.user.studentId);
    if (!student) {
      return res.status(404).json({ error: 'Không tìm thấy học sinh' });
    }
    const isCurrentValid = verifyPassword(currentPassword, student.passwordHash, student.passwordSalt);
    if (!isCurrentValid) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác' });
    }
    const newCred = hashPassword(newPassword);
    student.passwordHash = newCred.hash;
    student.passwordSalt = newCred.salt;
    student.customPasswordSet = true;
    saveDb(db);
    return res.json({ success: true, message: 'Đổi mật khẩu học sinh thành công' });
  }
});

// 4. Reset Student Password (Teacher only)
app.post('/api/auth/reset-student-password', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { studentId } = req.body;
  const db = loadDb();
  const student = db.students.find((s: any) => s.id === studentId || s.code === studentId);
  if (!student) {
    return res.status(404).json({ error: 'Không tìm thấy học sinh' });
  }
  const defaultPass = `${student.code}${formatDobToPasswordSuffix(student.dob)}`;
  const cred = hashPassword(defaultPass);
  student.passwordHash = cred.hash;
  student.passwordSalt = cred.salt;
  student.customPasswordSet = false;
  saveDb(db);
  return res.json({
    success: true,
    message: `Đã đặt lại mật khẩu cho học sinh ${student.name} về mặc định (${defaultPass})`,
    defaultPassword: defaultPass
  });
});

// 5. Get Students List
app.get('/api/students', authMiddleware, (req: any, res: any) => {
  const db = loadDb();
  if (req.user.role === 'teacher') {
    // Return all info + computed default password for easy credentials card/export
    const list = db.students.map((s: any) => {
      const defaultPass = `${s.code}${formatDobToPasswordSuffix(s.dob)}`;
      return {
        id: s.id,
        code: s.code,
        name: s.name,
        gender: s.gender,
        dob: s.dob,
        phone: s.phone,
        address: s.address,
        parentName: s.parentName,
        parentPhone: s.parentPhone,
        notes: s.notes,
        customPasswordSet: !!s.customPasswordSet,
        defaultPasswordFormat: defaultPass
      };
    });
    return res.json(list);
  } else {
    // Student role: only see basic info needed for seating chart (id, code, name, gender)
    const list = db.students.map((s: any) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      gender: s.gender
    }));
    return res.json(list);
  }
});

// 6. Create Student (Teacher only)
app.post('/api/students', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { code, name, gender, dob, phone, address, parentName, parentPhone, notes } = req.body;
  if (!code || !name || !gender || !dob) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ Mã học sinh, Họ tên, Giới tính, Ngày sinh' });
  }
  const db = loadDb();
  const cleanCode = code.trim().toUpperCase();
  if (db.students.some((s: any) => s.code.toUpperCase() === cleanCode)) {
    return res.status(400).json({ error: `Mã học sinh "${cleanCode}" đã tồn tại trên hệ thống` });
  }

  const defaultPass = `${cleanCode}${formatDobToPasswordSuffix(dob)}`;
  const cred = hashPassword(defaultPass);

  const newStudent = {
    id: cleanCode,
    code: cleanCode,
    name: name.trim(),
    gender: gender === 'Nữ' ? 'Nữ' : 'Nam',
    dob: dob.trim(),
    phone: phone ? phone.trim() : '',
    address: address ? address.trim() : '',
    parentName: parentName ? parentName.trim() : '',
    parentPhone: parentPhone ? parentPhone.trim() : '',
    notes: notes ? notes.trim() : '',
    passwordHash: cred.hash,
    passwordSalt: cred.salt,
    customPasswordSet: false,
    createdAt: new Date().toISOString()
  };

  db.students.push(newStudent);
  saveDb(db);
  return res.json({ success: true, student: newStudent });
});

// 7. Update Student (Teacher only)
app.put('/api/students/:id', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { id } = req.params;
  const { name, gender, dob, phone, address, parentName, parentPhone, notes } = req.body;
  const db = loadDb();
  const index = db.students.findIndex((s: any) => s.id === id || s.code === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy học sinh' });
  }

  const prev = db.students[index];
  db.students[index] = {
    ...prev,
    name: name !== undefined ? name.trim() : prev.name,
    gender: gender !== undefined ? gender : prev.gender,
    dob: dob !== undefined ? dob.trim() : prev.dob,
    phone: phone !== undefined ? phone.trim() : prev.phone,
    address: address !== undefined ? address.trim() : prev.address,
    parentName: parentName !== undefined ? parentName.trim() : prev.parentName,
    parentPhone: parentPhone !== undefined ? parentPhone.trim() : prev.parentPhone,
    notes: notes !== undefined ? notes.trim() : prev.notes
  };

  saveDb(db);
  return res.json({ success: true, student: db.students[index] });
});

// 8. Delete Student (Teacher only)
app.delete('/api/students/:id', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { id } = req.params;
  const db = loadDb();
  const student = db.students.find((s: any) => s.id === id || s.code === id);
  if (!student) {
    return res.status(404).json({ error: 'Không tìm thấy học sinh' });
  }

  // Remove from students list
  db.students = db.students.filter((s: any) => s.id !== student.id);

  // Clear seating
  if (db.seating && Array.isArray(db.seating.seats)) {
    db.seating.seats.forEach((seat: any) => {
      if (seat.studentId === student.id) {
        seat.studentId = null;
      }
    });
  }

  // Clear or preserve attendance / conduct / grades
  db.attendance = db.attendance.filter((a: any) => a.studentId !== student.id);
  db.conductLogs = db.conductLogs.filter((c: any) => c.studentId !== student.id);
  db.grades = db.grades.filter((g: any) => g.studentId !== student.id);
  db.honors = db.honors.filter((h: any) => h.studentId !== student.id);

  saveDb(db);
  return res.json({ success: true, message: `Đã xóa học sinh ${student.name}` });
});

// 9. Bulk Import Students (Teacher only)
app.post('/api/students/import', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { students: importList } = req.body;
  if (!Array.isArray(importList) || importList.length === 0) {
    return res.status(400).json({ error: 'Dữ liệu nhập trống hoặc không hợp lệ' });
  }

  const db = loadDb();
  const successRows: any[] = [];
  const errorRows: { row: number; code?: string; name?: string; reason: string }[] = [];

  const existingCodes = new Set(db.students.map((s: any) => s.code.toUpperCase()));

  importList.forEach((item: any, idx: number) => {
    const rowNum = idx + 1;
    const code = item.code ? String(item.code).trim().toUpperCase() : '';
    const name = item.name ? String(item.name).trim() : '';
    const gender = item.gender ? String(item.gender).trim() : 'Nam';
    const dob = item.dob ? String(item.dob).trim() : '';
    const phone = item.phone ? String(item.phone).trim() : '';
    const address = item.address ? String(item.address).trim() : '';

    if (!code) {
      errorRows.push({ row: rowNum, name, reason: 'Mã học sinh không được để trống' });
      return;
    }
    if (!name) {
      errorRows.push({ row: rowNum, code, reason: 'Họ và tên không được để trống' });
      return;
    }
    if (existingCodes.has(code)) {
      errorRows.push({ row: rowNum, code, name, reason: `Mã học sinh "${code}" đã tồn tại` });
      return;
    }

    const defaultPass = `${code}${formatDobToPasswordSuffix(dob)}`;
    const cred = hashPassword(defaultPass);

    const newStudent = {
      id: code,
      code,
      name,
      gender: gender.toLowerCase() === 'nữ' ? 'Nữ' : 'Nam',
      dob: dob || '01/01/2009',
      phone,
      address,
      passwordHash: cred.hash,
      passwordSalt: cred.salt,
      customPasswordSet: false,
      createdAt: new Date().toISOString()
    };

    db.students.push(newStudent);
    existingCodes.add(code);
    successRows.push(newStudent);
  });

  saveDb(db);
  return res.json({
    totalProcessed: importList.length,
    successCount: successRows.length,
    errorCount: errorRows.length,
    errors: errorRows,
    imported: successRows
  });
});

// 10. Student Profile with Permissions Check
app.get('/api/students/:id/profile', authMiddleware, (req: any, res: any) => {
  const { id } = req.params;
  const db = loadDb();
  const student = db.students.find((s: any) => s.id === id || s.code === id);
  if (!student) {
    return res.status(404).json({ error: 'Không tìm thấy học sinh' });
  }

  // Security check: If student, they can ONLY view their own profile!
  if (req.user.role === 'student' && req.user.studentId !== student.id) {
    return res.status(403).json({ error: 'Bạn không có quyền xem thông tin cá nhân của học sinh khác' });
  }

  const attendance = db.attendance.filter((a: any) => a.studentId === student.id);
  const grades = db.grades.filter((g: any) => g.studentId === student.id);
  const conduct = db.conductLogs.filter((c: any) => c.studentId === student.id);
  const honors = db.honors.filter((h: any) => h.studentId === student.id);

  // Return full profile
  return res.json({
    student: {
      id: student.id,
      code: student.code,
      name: student.name,
      gender: student.gender,
      dob: student.dob,
      phone: student.phone,
      address: student.address,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      notes: student.notes
    },
    attendance,
    grades,
    conduct,
    honors
  });
});

// 11. Seating Chart Layout
app.get('/api/seating', authMiddleware, (req: any, res: any) => {
  const db = loadDb();
  return res.json(db.seating || { seats: [], updatedAt: new Date().toISOString() });
});

app.put('/api/seating', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { seats } = req.body;
  if (!Array.isArray(seats)) {
    return res.status(400).json({ error: 'Danh sách vị trí chỗ ngồi không hợp lệ' });
  }

  // Validate no student is assigned to multiple seats
  const studentSeen = new Set<string>();
  for (const s of seats) {
    if (s.studentId) {
      if (studentSeen.has(s.studentId)) {
        return res.status(400).json({ error: `Không thể xếp 1 học sinh vào 2 chỗ ngồi khác nhau (Mã HS: ${s.studentId})` });
      }
      studentSeen.add(s.studentId);
    }
  }

  const db = loadDb();
  db.seating = {
    seats,
    updatedAt: new Date().toISOString()
  };
  saveDb(db);
  return res.json({ success: true, seating: db.seating });
});

// 12. Announcements
app.get('/api/announcements', authMiddleware, (req: any, res: any) => {
  const db = loadDb();
  if (req.user.role === 'teacher') {
    return res.json(db.announcements || []);
  } else {
    // Students only view published announcements
    const published = (db.announcements || []).filter((a: any) => a.isPublished);
    return res.json(published);
  }
});

app.post('/api/announcements', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { title, content, isPinned, isPublished, category, attachmentName } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Vui lòng nhập tiêu đề và nội dung thông báo' });
  }
  const db = loadDb();
  const newAnn = {
    id: `ann-${Date.now()}`,
    title: title.trim(),
    content: content.trim(),
    author: db.settings.teacherName || 'GVCN',
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    isPinned: Boolean(isPinned),
    isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
    category: category || 'Chung',
    attachmentName
  };
  db.announcements.unshift(newAnn);
  saveDb(db);
  return res.json(newAnn);
});

app.put('/api/announcements/:id', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { id } = req.params;
  const db = loadDb();
  const index = db.announcements.findIndex((a: any) => a.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy thông báo' });
  }
  db.announcements[index] = {
    ...db.announcements[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  saveDb(db);
  return res.json(db.announcements[index]);
});

app.delete('/api/announcements/:id', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { id } = req.params;
  const db = loadDb();
  db.announcements = db.announcements.filter((a: any) => a.id !== id);
  saveDb(db);
  return res.json({ success: true });
});

// 13. Honors
app.get('/api/honors', authMiddleware, (req: any, res: any) => {
  const db = loadDb();
  if (req.user.role === 'teacher') {
    return res.json(db.honors || []);
  } else {
    return res.json((db.honors || []).filter((h: any) => h.isPublished));
  }
});

app.post('/api/honors', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { studentId, title, description, badge, date, isPublished } = req.body;
  const db = loadDb();
  const student = db.students.find((s: any) => s.id === studentId || s.code === studentId);
  if (!student) {
    return res.status(400).json({ error: 'Vui lòng chọn học sinh được vinh danh' });
  }
  const newHonor = {
    id: `hon-${Date.now()}`,
    studentId: student.id,
    studentName: student.name,
    title: title.trim(),
    description: description ? description.trim() : '',
    badge: badge || 'trophy',
    date: date || new Date().toISOString().substring(0, 10),
    isPublished: isPublished !== undefined ? Boolean(isPublished) : true
  };
  db.honors.unshift(newHonor);
  saveDb(db);
  return res.json(newHonor);
});

app.put('/api/honors/:id', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { id } = req.params;
  const db = loadDb();
  const index = db.honors.findIndex((h: any) => h.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy bản ghi vinh danh' });
  }
  if (req.body.studentId) {
    const student = db.students.find((s: any) => s.id === req.body.studentId);
    if (student) {
      req.body.studentName = student.name;
    }
  }
  db.honors[index] = { ...db.honors[index], ...req.body };
  saveDb(db);
  return res.json(db.honors[index]);
});

app.delete('/api/honors/:id', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { id } = req.params;
  const db = loadDb();
  db.honors = db.honors.filter((h: any) => h.id !== id);
  saveDb(db);
  return res.json({ success: true });
});

// 14. Attendance
app.get('/api/attendance', authMiddleware, (req: any, res: any) => {
  const { date, studentId, month } = req.query;
  const db = loadDb();
  let records = db.attendance || [];
  if (date) {
    records = records.filter((r: any) => r.date === date);
  }
  if (month) {
    records = records.filter((r: any) => r.date.startsWith(month));
  }
  if (studentId) {
    if (req.user.role === 'student' && req.user.studentId !== studentId) {
      return res.status(403).json({ error: 'Không có quyền xem dữ liệu của học sinh khác' });
    }
    records = records.filter((r: any) => r.studentId === studentId);
  } else if (req.user.role === 'student') {
    // If student queries general attendance list, only return their own!
    records = records.filter((r: any) => r.studentId === req.user.studentId);
  }
  return res.json(records);
});

// Batch Save Attendance for a Date (Teacher only)
app.post('/api/attendance/batch', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { date, items } = req.body;
  if (!date || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Dữ liệu điểm danh không hợp lệ' });
  }

  const db = loadDb();
  // Filter out non-conduct-linked records for this date
  // We keep track of existing conduct-linked records so we don't accidentally clobber them unless overridden
  const otherDates = db.attendance.filter((a: any) => a.date !== date);
  const thisDateLinked = db.attendance.filter((a: any) => a.date === date && a.linkedConductId);

  const updatedThisDate: any[] = [];
  for (const item of items) {
    const existingLinked = thisDateLinked.find((l: any) => l.studentId === item.studentId);
    updatedThisDate.push({
      id: item.id || existingLinked?.id || `att-${Date.now()}-${item.studentId}`,
      studentId: item.studentId,
      date,
      status: item.status,
      note: item.note || existingLinked?.note || '',
      linkedConductId: existingLinked?.linkedConductId
    });
  }

  db.attendance = [...otherDates, ...updatedThisDate];
  saveDb(db);
  return res.json({ success: true, count: updatedThisDate.length });
});

// Single update attendance
app.put('/api/attendance', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { studentId, date, status, note } = req.body;
  if (!studentId || !date || !status) {
    return res.status(400).json({ error: 'Thiếu thông tin điểm danh' });
  }
  const db = loadDb();
  const index = db.attendance.findIndex((a: any) => a.studentId === studentId && a.date === date);
  if (index !== -1) {
    db.attendance[index].status = status;
    if (note !== undefined) db.attendance[index].note = note;
  } else {
    db.attendance.push({
      id: `att-${Date.now()}-${studentId}`,
      studentId,
      date,
      status,
      note: note || ''
    });
  }
  saveDb(db);
  return res.json({ success: true });
});

// 15. Grades / Academics
app.get('/api/grades', authMiddleware, (req: any, res: any) => {
  const { studentId, subjectId, semester } = req.query;
  const db = loadDb();
  let records = db.grades || [];
  if (studentId) {
    if (req.user.role === 'student' && req.user.studentId !== studentId) {
      return res.status(403).json({ error: 'Không có quyền xem điểm của học sinh khác' });
    }
    records = records.filter((r: any) => r.studentId === studentId);
  } else if (req.user.role === 'student') {
    records = records.filter((r: any) => r.studentId === req.user.studentId);
  }

  if (subjectId) {
    records = records.filter((r: any) => r.subjectId === subjectId);
  }
  if (semester) {
    records = records.filter((r: any) => r.semester === semester);
  }
  return res.json(records);
});

app.post('/api/grades', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { studentId, subjectId, semester, assessmentType, score, qualitativeRating, note, date } = req.body;
  const db = loadDb();
  const student = db.students.find((s: any) => s.id === studentId || s.code === studentId);
  if (!student) {
    return res.status(400).json({ error: 'Học sinh không tồn tại' });
  }

  const newGrade = {
    id: `gr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    studentId: student.id,
    subjectId,
    semester: semester || 'HK1',
    assessmentType: assessmentType || 'TX1',
    score: score !== undefined && score !== '' ? Number(score) : undefined,
    qualitativeRating,
    note,
    date: date || new Date().toISOString().substring(0, 10)
  };
  db.grades.push(newGrade);
  saveDb(db);
  return res.json(newGrade);
});

app.put('/api/grades/:id', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { id } = req.params;
  const db = loadDb();
  const idx = db.grades.findIndex((g: any) => g.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Không tìm thấy bản ghi điểm' });
  }
  db.grades[idx] = { ...db.grades[idx], ...req.body };
  saveDb(db);
  return res.json(db.grades[idx]);
});

app.delete('/api/grades/:id', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { id } = req.params;
  const db = loadDb();
  db.grades = db.grades.filter((g: any) => g.id !== id);
  saveDb(db);
  return res.json({ success: true });
});

app.post('/api/grades/import', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { grades: gradeList } = req.body;
  if (!Array.isArray(gradeList) || gradeList.length === 0) {
    return res.status(400).json({ error: 'Dữ liệu bảng điểm trống hoặc không đúng định dạng' });
  }
  const db = loadDb();
  const successRows: any[] = [];
  const errors: any[] = [];

  gradeList.forEach((row: any, idx: number) => {
    const rowNum = idx + 1;
    const student = db.students.find(
      (s: any) => s.code.toUpperCase() === String(row.studentCode || '').trim().toUpperCase()
    );
    if (!student) {
      errors.push({ row: rowNum, studentCode: row.studentCode, reason: 'Mã học sinh không tồn tại' });
      return;
    }
    const subject = db.settings.subjects.find(
      (sub: any) => sub.id === row.subjectId || sub.code === row.subjectCode || sub.name === row.subjectName
    );
    if (!subject) {
      errors.push({ row: rowNum, subject: row.subjectName || row.subjectCode, reason: 'Môn học không tồn tại' });
      return;
    }

    const newGrade = {
      id: `gr-${Date.now()}-${idx}`,
      studentId: student.id,
      subjectId: subject.id,
      semester: row.semester || 'HK1',
      assessmentType: row.assessmentType || 'TX1',
      score: row.score !== undefined && row.score !== '' ? Number(row.score) : undefined,
      qualitativeRating: row.qualitativeRating,
      note: row.note,
      date: row.date || new Date().toISOString().substring(0, 10)
    };
    db.grades.push(newGrade);
    successRows.push(newGrade);
  });

  saveDb(db);
  return res.json({
    total: gradeList.length,
    successCount: successRows.length,
    errorCount: errors.length,
    errors
  });
});

// 16. Conduct & Discipline (Thi đua)
app.get('/api/conduct/logs', authMiddleware, (req: any, res: any) => {
  const { studentId, month } = req.query;
  const db = loadDb();
  let logs = db.conductLogs || [];

  if (studentId) {
    if (req.user.role === 'student' && req.user.studentId !== studentId) {
      return res.status(403).json({ error: 'Không có quyền xem lịch sử thi đua của học sinh khác' });
    }
    logs = logs.filter((l: any) => l.studentId === studentId);
  } else if (req.user.role === 'student') {
    logs = logs.filter((l: any) => l.studentId === req.user.studentId);
  }

  if (month && month !== 'ALL') {
    logs = logs.filter((l: any) => l.date.startsWith(month));
  }

  return res.json(logs);
});

// Add Conduct Log (with automatic attendance sync if rule is linked!)
app.post('/api/conduct/logs', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { studentId, ruleId, date, note, points: overridePoints } = req.body;
  const db = loadDb();
  const student = db.students.find((s: any) => s.id === studentId || s.code === studentId);
  if (!student) {
    return res.status(400).json({ error: 'Vui lòng chọn học sinh' });
  }
  const rule = db.settings.conductRules.find((r: any) => r.id === ruleId);
  if (!rule) {
    return res.status(400).json({ error: 'Quy tắc thi đua không hợp lệ' });
  }

  const logId = `log-${Date.now()}`;
  const points = overridePoints !== undefined ? Number(overridePoints) : rule.points;
  const eventDate = date || new Date().toISOString().substring(0, 10);

  let syncedAttendanceId: string | undefined = undefined;

  // Auto-sync with attendance if configured
  if (rule.linkAttendance && rule.attendanceStatus) {
    const existingAttIndex = db.attendance.findIndex(
      (a: any) => a.studentId === student.id && a.date === eventDate
    );
    if (existingAttIndex !== -1) {
      db.attendance[existingAttIndex].status = rule.attendanceStatus;
      db.attendance[existingAttIndex].linkedConductId = logId;
      syncedAttendanceId = db.attendance[existingAttIndex].id;
    } else {
      syncedAttendanceId = `att-sync-${Date.now()}`;
      db.attendance.push({
        id: syncedAttendanceId,
        studentId: student.id,
        date: eventDate,
        status: rule.attendanceStatus,
        note: `Đồng bộ từ sự việc: ${rule.name}`,
        linkedConductId: logId
      });
    }
  }

  const newLog = {
    id: logId,
    studentId: student.id,
    studentName: student.name,
    ruleId: rule.id,
    ruleCode: rule.code,
    ruleName: rule.name,
    points,
    date: eventDate,
    note: note ? note.trim() : '',
    syncedAttendanceId
  };

  db.conductLogs.unshift(newLog);
  saveDb(db);
  return res.json(newLog);
});

// Edit Conduct Log
app.put('/api/conduct/logs/:id', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { id } = req.params;
  const { ruleId, date, points, note } = req.body;
  const db = loadDb();
  const idx = db.conductLogs.findIndex((l: any) => l.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Không tìm thấy sự việc thi đua' });
  }

  const current = db.conductLogs[idx];
  let ruleName = current.ruleName;
  let ruleCode = current.ruleCode;

  if (ruleId && ruleId !== current.ruleId) {
    const rule = db.settings.conductRules.find((r: any) => r.id === ruleId);
    if (rule) {
      ruleName = rule.name;
      ruleCode = rule.code;
      // Re-sync attendance if linked
      if (rule.linkAttendance && rule.attendanceStatus && current.syncedAttendanceId) {
        const att = db.attendance.find((a: any) => a.id === current.syncedAttendanceId);
        if (att) {
          att.status = rule.attendanceStatus;
        }
      }
    }
  }

  db.conductLogs[idx] = {
    ...current,
    ruleId: ruleId || current.ruleId,
    ruleCode,
    ruleName,
    points: points !== undefined ? Number(points) : current.points,
    date: date || current.date,
    note: note !== undefined ? note : current.note
  };

  saveDb(db);
  return res.json(db.conductLogs[idx]);
});

// Delete Conduct Log
app.delete('/api/conduct/logs/:id', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { id } = req.params;
  const db = loadDb();
  const log = db.conductLogs.find((l: any) => l.id === id);
  if (!log) {
    return res.status(404).json({ error: 'Không tìm thấy sự việc thi đua' });
  }

  // If this log was linked to an attendance record, revert or remove synced attendance
  if (log.syncedAttendanceId) {
    db.attendance = db.attendance.filter((a: any) => a.id !== log.syncedAttendanceId && a.linkedConductId !== id);
  }

  db.conductLogs = db.conductLogs.filter((l: any) => l.id !== id);
  saveDb(db);
  return res.json({ success: true });
});

// Period Evaluations (Rating confirmation / reason)
app.get('/api/conduct/evaluations', authMiddleware, (req: any, res: any) => {
  const { period } = req.query;
  const db = loadDb();
  return res.json(db.periodEvaluations?.[String(period)] || {});
});

app.put('/api/conduct/evaluations', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { period, evaluations } = req.body;
  if (!period || !evaluations) {
    return res.status(400).json({ error: 'Thiếu kỳ đánh giá hoặc dữ liệu' });
  }
  const db = loadDb();
  if (!db.periodEvaluations) db.periodEvaluations = {};
  db.periodEvaluations[period] = evaluations;
  saveDb(db);
  return res.json({ success: true });
});

// 17. Settings
app.get('/api/settings/public', (_req: any, res: any) => {
  const db = loadDb();
  return res.json({
    appName: db.settings.appName,
    schoolName: db.settings.schoolName,
    className: db.settings.className || '7A1',
    teacherName: db.settings.teacherName,
    schoolYear: db.settings.schoolYear || '2025 - 2026',
    accentColor: db.settings.accentColor
  });
});

app.get('/api/settings', (req: any, res: any) => {
  const db = loadDb();
  return res.json(db.settings);
});

app.put('/api/settings', authMiddleware, requireTeacher, async (req: any, res: any) => {
  const db = loadDb();
  db.settings = {
    ...db.settings,
    ...req.body
  };
  if (req.body.teacherName && db.teacher) {
    db.teacher.name = req.body.teacherName;
  }
  saveDb(db);

  // Tự động đồng bộ lên Supabase nếu đã có cấu hình kết nối
  if (isSupabaseConfigured && supabaseServer) {
    try {
      const activeClassId = (db.settings.className || '7A1').trim();
      await supabaseServer.from('class_settings').upsert({
        class_id: activeClassId,
        app_name: db.settings.appName,
        school_name: db.settings.schoolName,
        class_name: db.settings.className,
        teacher_name: db.settings.teacherName,
        school_year: db.settings.schoolYear,
        base_conduct_score: db.settings.baseConductScore,
        accent_color: db.settings.accentColor,
        conduct_rules: db.settings.conductRules,
        evaluation_tiers: db.settings.evaluationTiers,
        subjects: db.settings.subjects,
        updated_at: new Date().toISOString()
      }, { onConflict: 'class_id' });

      // Đảm bảo tạo phân công trong teacher_assignments trước khi cập nhật assigned_class_id
      try {
        const { data: teacherProfiles } = await supabaseServer.from('profiles').select('id').eq('role', 'teacher');
        if (teacherProfiles && teacherProfiles.length > 0) {
          for (const tp of teacherProfiles) {
            await supabaseServer.from('teacher_assignments').upsert({
              teacher_id: tp.id,
              class_id: activeClassId,
              school_year: db.settings.schoolYear || '2025 - 2026',
              role: 'head_teacher',
              is_active: true
            }, { onConflict: 'teacher_id,class_id,school_year' });
          }
        }
      } catch (e: any) {
        console.warn('Cập nhật teacher_assignments ngầm:', e?.message || e);
      }

      // Cập nhật lớp phụ trách cho giáo viên trên Supabase để RLS lập tức có hiệu lực
      await supabaseServer.from('profiles').update({
        assigned_class_id: activeClassId,
        name: db.settings.teacherName,
        updated_at: new Date().toISOString()
      }).eq('role', 'teacher');

      // Đồng bộ snapshot trạng thái vào gvcn_v2_state
      try {
        await supabaseServer.from('gvcn_v2_state').upsert({
          id: 'current_state',
          class_id: activeClassId,
          schema_version: '2.1.0',
          school_year: db.settings.schoolYear || '2025 - 2026',
          app_state: {
            appName: db.settings.appName,
            schoolName: db.settings.schoolName,
            className: db.settings.className,
            schoolYear: db.settings.schoolYear,
            updatedAt: new Date().toISOString()
          },
          last_synced_at: new Date().toISOString()
        }, { onConflict: 'class_id,id' });
      } catch (e: any) {
        console.warn('Cập nhật gvcn_v2_state ngầm:', e?.message || e);
      }
    } catch (e: any) {
      console.warn('Lưu cấu hình lên Supabase ngầm (warning):', e?.message || e);
    }
  }

  return res.json(db.settings);
});

// Endpoint Kết thúc năm học – Khởi tạo năm học mới
app.post('/api/settings/reset-school-year', authMiddleware, requireTeacher, async (req: any, res: any) => {
  const { newClassName, newSchoolName, newSchoolYear, confirmText } = req.body;
  if (!confirmText || confirmText.trim().toUpperCase() !== 'KHOI TAO NAM HOC MOI') {
    return res.status(400).json({ error: 'Từ khóa xác nhận không chính xác. Vui lòng nhập đúng "KHOI TAO NAM HOC MOI" để tiếp tục.' });
  }

  const db = loadDb();
  const oldClassId = (db.settings.className || '7A1').trim();
  const updatedClassName = (newClassName || db.settings.className || '7A1').trim();
  const updatedSchoolName = (newSchoolName || db.settings.schoolName || 'THPT Chuyên Lê Hồng Phong').trim();
  const updatedSchoolYear = (newSchoolYear || '2026 - 2027').trim();

  // Reset operational data for the current year
  db.students = [];
  db.attendance = [];
  db.grades = [];
  db.conductLogs = [];
  db.periodEvaluations = {};
  db.announcements = [];
  db.honors = [];
  db.seating = {
    seats: [],
    updatedAt: new Date().toISOString()
  };

  // Update settings for the new year
  db.settings.className = updatedClassName;
  db.settings.schoolName = updatedSchoolName;
  db.settings.schoolYear = updatedSchoolYear;

  saveDb(db);

  // If Supabase is configured, execute class reset on Supabase safely
  if (isSupabaseConfigured && supabaseServer) {
    try {
      // 1. Delete class operational data
      await supabaseServer.from('period_evaluations').delete().eq('class_id', oldClassId);
      await supabaseServer.from('conduct_logs').delete().eq('class_id', oldClassId);
      await supabaseServer.from('grades').delete().eq('class_id', oldClassId);
      await supabaseServer.from('attendance').delete().eq('class_id', oldClassId);
      await supabaseServer.from('honors').delete().eq('class_id', oldClassId);
      await supabaseServer.from('announcements').delete().eq('class_id', oldClassId);
      await supabaseServer.from('students').delete().eq('class_id', oldClassId);

      // 2. Reset student accounts linked to this class back to pending/unassigned
      await supabaseServer.from('profiles').update({
        assigned_class_id: null,
        student_id: null,
        approval_status: 'pending',
        updated_at: new Date().toISOString()
      }).eq('assigned_class_id', oldClassId).eq('role', 'student');

      // 3. Reset seating layout
      await supabaseServer.from('seating_layout').upsert({
        class_id: updatedClassName,
        id: 'main',
        seats: [],
        updated_at: new Date().toISOString()
      }, { onConflict: 'class_id,id' });

      // 4. Update class_settings
      await supabaseServer.from('class_settings').upsert({
        class_id: updatedClassName,
        app_name: db.settings.appName,
        school_name: updatedSchoolName,
        class_name: updatedClassName,
        teacher_name: db.settings.teacherName,
        school_year: updatedSchoolYear,
        base_conduct_score: db.settings.baseConductScore,
        accent_color: db.settings.accentColor,
        conduct_rules: db.settings.conductRules,
        evaluation_tiers: db.settings.evaluationTiers,
        subjects: db.settings.subjects,
        updated_at: new Date().toISOString()
      }, { onConflict: 'class_id' });

      // 5. Update teacher profile and teacher_assignments
      try {
        const { data: teacherProfiles } = await supabaseServer.from('profiles').select('id').eq('role', 'teacher');
        if (teacherProfiles && teacherProfiles.length > 0) {
          for (const tp of teacherProfiles) {
            await supabaseServer.from('teacher_assignments').upsert({
              teacher_id: tp.id,
              class_id: updatedClassName,
              school_year: updatedSchoolYear,
              role: 'head_teacher',
              is_active: true
            }, { onConflict: 'teacher_id,class_id,school_year' });
          }
        }
      } catch (e: any) {
        console.warn('Sync teacher assignments for new year:', e?.message || e);
      }

      await supabaseServer.from('profiles').update({
        assigned_class_id: updatedClassName,
        updated_at: new Date().toISOString()
      }).eq('role', 'teacher');

      // 6. Update gvcn_v2_state
      try {
        await supabaseServer.from('gvcn_v2_state').upsert({
          id: 'current_state',
          class_id: updatedClassName,
          schema_version: '2.1.0',
          school_year: updatedSchoolYear,
          app_state: {
            action: 'reset_school_year',
            appName: db.settings.appName,
            className: updatedClassName,
            schoolYear: updatedSchoolYear,
            resetAt: new Date().toISOString()
          },
          last_synced_at: new Date().toISOString()
        }, { onConflict: 'class_id,id' });
      } catch (e: any) {
        console.warn('Sync gvcn_v2_state for new year:', e?.message || e);
      }

    } catch (e: any) {
      console.warn('Lỗi đồng bộ reset năm học lên Supabase:', e?.message || e);
    }
  }

  return res.json({
    success: true,
    message: `Đã kết thúc năm học cũ và khởi tạo thành công năm học mới ${updatedSchoolYear} cho lớp ${updatedClassName}!`,
    settings: db.settings
  });
});

// 18. Backup & Restore
app.get('/api/backup/export', authMiddleware, requireTeacher, (req: any, res: any) => {
  const db = loadDb();
  // Safe export: keep passwords hashed
  const exportPayload = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    data: db
  };
  res.setHeader('Content-Disposition', `attachment; filename="GVCN_Backup_${new Date().toISOString().substring(0, 10)}.json"`);
  res.setHeader('Content-Type', 'application/json');
  return res.send(JSON.stringify(exportPayload, null, 2));
});

app.post('/api/backup/restore', authMiddleware, requireTeacher, (req: any, res: any) => {
  const { data } = req.body;
  if (!data || !data.teacher || !Array.isArray(data.students)) {
    return res.status(400).json({ error: 'Tệp sao lưu không hợp lệ hoặc thiếu dữ liệu cốt lõi' });
  }
  saveDb(data);
  return res.json({ success: true, message: 'Khôi phục dữ liệu thành công' });
});

// 19. Supabase Integration Routes (Project: thuy-trang)
app.get('/api/supabase/status', authMiddleware, async (_req: any, res: any) => {
  return res.json({
    projectName: SUPABASE_PROJECT_NAME,
    isConfigured: isSupabaseConfigured,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 18)}...` : '',
    hasKey: Boolean(supabaseKey)
  });
});

app.post('/api/supabase/test', authMiddleware, requireTeacher, async (_req: any, res: any) => {
  if (!isSupabaseConfigured || !supabaseServer) {
    return res.status(400).json({
      success: false,
      message: `Chưa cấu hình biến môi trường VITE_SUPABASE_URL hoặc VITE_SUPABASE_PUBLISHABLE_KEY cho project "${SUPABASE_PROJECT_NAME}".`
    });
  }

  try {
    const { data, error } = await supabaseServer.from('class_settings').select('id').limit(1);
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205' || (error.message && error.message.includes('schema cache'))) {
        return res.json({
          success: true,
          message: 'Kết nối mạng và xác thực Supabase THÀNH CÔNG! Tuy nhiên, các bảng dữ liệu chưa được khởi tạo trong SQL Editor (vui lòng thực thi file supabase/schema.sql trong Supabase).',
          tablesCreated: false
        });
      }
      return res.status(500).json({
        success: false,
        message: `Lỗi truy vấn Supabase: ${error.message} (${error.code})`
      });
    }
    return res.json({
      success: true,
      message: `Kết nối thành công đến project Supabase "${SUPABASE_PROJECT_NAME}"! Bảng dữ liệu đã sẵn sàng.`,
      tablesCreated: true
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: `Lỗi kết nối Supabase: ${err.message || err}`
    });
  }
});

// Serve SQL schema and migration scripts for 1-click copy & download in Settings UI
app.get('/supabase/schema.sql', (_req: any, res: any) => {
  const schemaPath = path.join(__dirname, 'supabase', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.sendFile(schemaPath);
  }
  return res.status(404).send('-- Schema file not found');
});

app.get('/supabase/migration_class_management.sql', (_req: any, res: any) => {
  const migPath = path.join(__dirname, 'supabase', 'migration_class_management.sql');
  if (fs.existsSync(migPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.sendFile(migPath);
  }
  return res.status(404).send('-- Migration file not found');
});

app.get('/supabase/migration_single_school_year_reset.sql', (_req: any, res: any) => {
  const migPath = path.join(__dirname, 'supabase', 'migration_single_school_year_reset.sql');
  if (fs.existsSync(migPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.sendFile(migPath);
  }
  return res.status(404).send('-- Migration file not found');
});

app.post('/api/supabase/sync-up', authMiddleware, requireTeacher, async (_req: any, res: any) => {
  if (!isSupabaseConfigured || !supabaseServer) {
    return res.status(400).json({
      error: 'Chưa cấu hình thông tin kết nối Supabase'
    });
  }

  const db = loadDb();
  const activeClassId = (db.settings.className || '7A1').trim();

  try {
    await supabaseServer.from('class_settings').upsert({
      class_id: activeClassId,
      app_name: db.settings.appName,
      school_name: db.settings.schoolName,
      class_name: db.settings.className,
      teacher_name: db.settings.teacherName,
      school_year: db.settings.schoolYear,
      base_conduct_score: db.settings.baseConductScore,
      accent_color: db.settings.accentColor,
      conduct_rules: db.settings.conductRules,
      evaluation_tiers: db.settings.evaluationTiers,
      subjects: db.settings.subjects,
      updated_at: new Date().toISOString()
    }, { onConflict: 'class_id' });

    // Tạo/cập nhật quyền phân công trong teacher_assignments
    try {
      const { data: teacherProfiles } = await supabaseServer.from('profiles').select('id').eq('role', 'teacher');
      if (teacherProfiles && teacherProfiles.length > 0) {
        for (const tp of teacherProfiles) {
          await supabaseServer.from('teacher_assignments').upsert({
            teacher_id: tp.id,
            class_id: activeClassId,
            school_year: db.settings.schoolYear || '2025 - 2026',
            role: 'head_teacher',
            is_active: true
          }, { onConflict: 'teacher_id,class_id,school_year' });
        }
      }
    } catch (e: any) {
      console.warn('Sync teacher_assignments:', e?.message || e);
    }

    // Cập nhật lớp phụ trách cho giáo viên trên Supabase
    await supabaseServer.from('profiles').update({
      assigned_class_id: activeClassId,
      name: db.settings.teacherName,
      updated_at: new Date().toISOString()
    }).eq('role', 'teacher');

    // Đồng bộ gvcn_v2_state
    try {
      await supabaseServer.from('gvcn_v2_state').upsert({
        id: 'current_state',
        class_id: activeClassId,
        schema_version: '2.1.0',
        school_year: db.settings.schoolYear || '2025 - 2026',
        app_state: {
          appName: db.settings.appName,
          schoolName: db.settings.schoolName,
          className: db.settings.className,
          schoolYear: db.settings.schoolYear,
          updatedAt: new Date().toISOString()
        },
        last_synced_at: new Date().toISOString()
      }, { onConflict: 'class_id,id' });
    } catch (e: any) {
      console.warn('Sync gvcn_v2_state:', e?.message || e);
    }

    if (db.seating) {
      await supabaseServer.from('seating_layout').upsert({
        id: 'main',
        class_id: activeClassId,
        seats: db.seating.seats,
        updated_at: new Date().toISOString()
      }, { onConflict: 'class_id,id' });
    }

    if (Array.isArray(db.announcements) && db.announcements.length > 0) {
      const annRows = db.announcements.map((a: any) => ({
        id: a.id,
        class_id: activeClassId,
        title: a.title,
        content: a.content,
        author: a.author,
        created_at: a.createdAt,
        is_pinned: a.isPinned,
        is_published: a.isPublished,
        category: a.category,
        attachment_name: a.attachmentName
      }));
      await supabaseServer.from('announcements').upsert(annRows, { onConflict: 'id' });
    }

    return res.json({ success: true, message: `Đã đồng bộ dữ liệu cài đặt, sơ đồ và bảng tin lớp ${activeClassId} lên Supabase thành công!` });
  } catch (err: any) {
    return res.status(500).json({ error: `Lỗi đồng bộ lên Supabase: ${err.message}` });
  }
});

// Vite middleware mounting in dev or static serving in prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: any, res: any) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

// Start standalone HTTP listener only when NOT running as a serverless function (e.g. Vercel)
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}

export { app };
export default app;

