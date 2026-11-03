import * as XLSX from 'xlsx';
import type {
  UserSession,
  Student,
  Announcement,
  SeatingLayout,
  Honor,
  AttendanceRecord,
  GradeRecord,
  ConductLog,
  AppSettings,
  PeriodEvaluation
} from '../types';

let cachedToken: string | null = typeof window !== 'undefined'
  ? (sessionStorage.getItem('gvcn_auth_token') || localStorage.getItem('gvcn_auth_token'))
  : null;

export function getToken(): string | null {
  return cachedToken;
}

export function setToken(token: string | null) {
  cachedToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      sessionStorage.setItem('gvcn_auth_token', token);
      localStorage.setItem('gvcn_auth_token', token);
    } else {
      sessionStorage.removeItem('gvcn_auth_token');
      localStorage.removeItem('gvcn_auth_token');
    }
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (cachedToken) {
    headers['Authorization'] = `Bearer ${cachedToken}`;
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorMsg = `Lỗi hệ thống (${response.status})`;
    try {
      const data = await response.json();
      if (data && data.error) {
        errorMsg = data.error;
      }
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

// Authentication
export const authApi = {
  login: async (username: string, password: string) => {
    const res = await request<{ token: string; user: UserSession }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setToken(res.token);
    return res;
  },

  getMe: async () => {
    return request<{ user: UserSession; settings: AppSettings }>('/api/auth/me');
  },

  logout: () => {
    setToken(null);
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    return request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  resetStudentPassword: async (studentId: string) => {
    return request<{ success: boolean; message: string; defaultPassword: string }>('/api/auth/reset-student-password', {
      method: 'POST',
      body: JSON.stringify({ studentId })
    });
  }
};

// Students
export const studentApi = {
  getAll: () => request<Student[]>('/api/students'),
  create: (data: Partial<Student>) => request<{ success: boolean; student: Student }>('/api/students', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (id: string, data: Partial<Student>) => request<{ success: boolean; student: Student }>(`/api/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: (id: string) => request<{ success: boolean; message: string }>(`/api/students/${id}`, {
    method: 'DELETE'
  }),
  import: (students: Partial<Student>[], mode: 'append' | 'replace' = 'append') => request<{
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    errors: Array<{ row: number; code?: string; name?: string; reason: string }>;
    imported: Student[];
    mode: 'append' | 'replace';
  }>('/api/students/import', {
    method: 'POST',
    body: JSON.stringify({ students, mode })
  }),
  cleanClass: (confirmText: string) => request<{ success: boolean; message: string }>('/api/students/clean-class', {
    method: 'POST',
    body: JSON.stringify({ confirmText })
  }),
  getProfile: (id: string) => request<{
    student: Student;
    attendance: AttendanceRecord[];
    grades: GradeRecord[];
    conduct: ConductLog[];
    honors: Honor[];
  }>(`/api/students/${id}/profile`)
};

// Seating
export const seatingApi = {
  get: () => request<SeatingLayout>('/api/seating'),
  update: (seats: SeatingLayout['seats']) => request<{ success: boolean; seating: SeatingLayout }>('/api/seating', {
    method: 'PUT',
    body: JSON.stringify({ seats })
  })
};

// Announcements
export const announcementApi = {
  getAll: () => request<Announcement[]>('/api/announcements'),
  create: (data: Partial<Announcement>) => request<Announcement>('/api/announcements', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (id: string, data: Partial<Announcement>) => request<Announcement>(`/api/announcements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: (id: string) => request<{ success: boolean }>(`/api/announcements/${id}`, {
    method: 'DELETE'
  })
};

// Honors
export const honorApi = {
  getAll: () => request<Honor[]>('/api/honors'),
  create: (data: Partial<Honor>) => request<Honor>('/api/honors', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (id: string, data: Partial<Honor>) => request<Honor>(`/api/honors/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: (id: string) => request<{ success: boolean }>(`/api/honors/${id}`, {
    method: 'DELETE'
  })
};

// Attendance
export const attendanceApi = {
  get: (params?: { date?: string; month?: string; studentId?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<AttendanceRecord[]>(`/api/attendance${query ? `?${query}` : ''}`);
  },
  batchSave: (date: string, items: Array<{ studentId: string; status: AttendanceRecord['status']; note?: string }>) => {
    return request<{ success: boolean; count: number }>('/api/attendance/batch', {
      method: 'POST',
      body: JSON.stringify({ date, items })
    });
  },
  updateSingle: (data: { studentId: string; date: string; status: AttendanceRecord['status']; note?: string }) => {
    return request<{ success: boolean }>('/api/attendance', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
};

// Grades
export const gradeApi = {
  get: (params?: { studentId?: string; subjectId?: string; semester?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<GradeRecord[]>(`/api/grades${query ? `?${query}` : ''}`);
  },
  create: (data: Partial<GradeRecord>) => request<GradeRecord>('/api/grades', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (id: string, data: Partial<GradeRecord>) => request<GradeRecord>(`/api/grades/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: (id: string) => request<{ success: boolean }>(`/api/grades/${id}`, {
    method: 'DELETE'
  }),
  import: (grades: any[]) => request<{
    total: number;
    successCount: number;
    errorCount: number;
    errors: any[];
  }>('/api/grades/import', {
    method: 'POST',
    body: JSON.stringify({ grades })
  })
};

// Conduct
export const conductApi = {
  getLogs: (params?: { studentId?: string; month?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return request<ConductLog[]>(`/api/conduct/logs${query ? `?${query}` : ''}`);
  },
  createLog: (data: { studentId: string; ruleId: string; date: string; note?: string; points?: number }) => {
    return request<ConductLog>('/api/conduct/logs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  updateLog: (id: string, data: Partial<ConductLog>) => {
    return request<ConductLog>(`/api/conduct/logs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  deleteLog: (id: string) => {
    return request<{ success: boolean }>(`/api/conduct/logs/${id}`, {
      method: 'DELETE'
    });
  },
  getEvaluations: (period: string) => {
    return request<Record<string, PeriodEvaluation>>(`/api/conduct/evaluations?period=${period}`);
  },
  saveEvaluations: (period: string, evaluations: Record<string, PeriodEvaluation>) => {
    return request<{ success: boolean }>('/api/conduct/evaluations', {
      method: 'PUT',
      body: JSON.stringify({ period, evaluations })
    });
  }
};

// Settings
export const settingsApi = {
  get: () => request<AppSettings>('/api/settings'),
  getPublic: () => request<AppSettings>('/api/settings/public'),
  update: (data: Partial<AppSettings>) => request<AppSettings>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  resetSchoolYear: (data: {
    newClassName: string;
    newSchoolName: string;
    newSchoolYear: string;
    confirmText: string;
  }) => request<{ success: boolean; message: string; settings: AppSettings }>('/api/settings/reset-school-year', {
    method: 'POST',
    body: JSON.stringify(data)
  })
};

// Backup
export const backupApi = {
  exportUrl: () => `/api/backup/export?token=${cachedToken}`,
  restore: (data: any) => request<{ success: boolean; message: string }>('/api/backup/restore', {
    method: 'POST',
    body: JSON.stringify({ data })
  })
};

// Supabase Integration Service (Project: thuy-trang)
export const supabaseApi = {
  getStatus: () => request<{
    projectName: string;
    isConfigured: boolean;
    url: string;
    hasKey: boolean;
  }>('/api/supabase/status'),

  testConnection: () => request<{
    success: boolean;
    message: string;
  }>('/api/supabase/test', {
    method: 'POST'
  }),

  syncUp: () => request<{
    success: boolean;
    message: string;
  }>('/api/supabase/sync-up', {
    method: 'POST'
  })
};

// Excel Helpers using XLSX library
export const excelService = {
  // 1. Download Student Import Template
  downloadStudentTemplate: () => {
    const sampleRows = [
      {
        'Mã học sinh': 'HS31',
        'Họ và tên': 'Nguyễn Hà My',
        'Giới tính': 'Nữ',
        'Ngày sinh': '15/05/2009',
        'Số điện thoại liên hệ': '0987654321',
        'Địa chỉ': '123 Đường Điện Biên Phủ, Q. Bình Thạnh',
        'Họ tên phụ huynh': 'Nguyễn Văn Hùng',
        'SĐT phụ huynh': '0903123456',
        'Ghi chú': 'Đoàn viên thanh niên'
      },
      {
        'Mã học sinh': 'HS32',
        'Họ và tên': 'Lê Quang Huy',
        'Giới tính': 'Nam',
        'Ngày sinh': '20/11/2009',
        'Số điện thoại liên hệ': '0912987654',
        'Địa chỉ': '45 Võ Thị Sáu, Q.3',
        'Họ tên phụ huynh': 'Lê Thị Thu',
        'SĐT phụ huynh': '0918765432',
        'Ghi chú': ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 24 },
      { wch: 10 },
      { wch: 14 },
      { wch: 22 },
      { wch: 35 },
      { wch: 24 },
      { wch: 16 },
      { wch: 25 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách mẫu');
    XLSX.writeFile(workbook, 'Mau_Nhap_Hoc_Sinh_GVCN.xlsx');
  },

  // 2. Parse uploaded student Excel file
  parseStudentFile: async (file: File): Promise<{
    rows: Partial<Student>[];
    errors: string[];
  }> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);

    const rows: Partial<Student>[] = [];
    const errors: string[] = [];

    rawRows.forEach((row, i) => {
      const rowNum = i + 2; // Header is row 1
      const code = row['Mã học sinh'] || row['Ma hoc sinh'] || row['Mã HS'] || row['Code'];
      const name = row['Họ và tên'] || row['Ho va ten'] || row['Họ tên'] || row['Name'];
      const gender = row['Giới tính'] || row['Gioi tinh'] || row['Gender'] || 'Nam';
      let dob = row['Ngày sinh'] || row['Ngay sinh'] || row['DOB'] || '';
      const phone = row['Số điện thoại liên hệ'] || row['Số điện thoại'] || row['SĐT'] || row['Phone'] || '';
      const address = row['Địa chỉ'] || row['Dia chi'] || '';
      const parentName = row['Họ tên phụ huynh'] || row['Phụ huynh'] || '';
      const parentPhone = row['SĐT phụ huynh'] || row['SĐT PH'] || '';
      const notes = row['Ghi chú'] || row['Ghi chu'] || '';

      if (!code || !String(code).trim()) {
        errors.push(`Dòng ${rowNum}: Thiếu mã học sinh`);
        return;
      }
      if (!name || !String(name).trim()) {
        errors.push(`Dòng ${rowNum}: Thiếu họ và tên học sinh (Mã: ${code})`);
        return;
      }

      // Format date if it's an Excel serial date number
      if (typeof dob === 'number') {
        const parsedDate = new Date(Math.round((dob - 25569) * 86400 * 1000));
        const d = String(parsedDate.getDate()).padStart(2, '0');
        const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const y = parsedDate.getFullYear();
        dob = `${d}/${m}/${y}`;
      } else {
        dob = String(dob).trim();
      }

      rows.push({
        code: String(code).trim().toUpperCase(),
        name: String(name).trim(),
        gender: String(gender).trim().toLowerCase() === 'nữ' ? 'Nữ' : 'Nam',
        dob: dob || '01/01/2009',
        phone: String(phone).trim(),
        address: String(address).trim(),
        parentName: String(parentName).trim(),
        parentPhone: String(parentPhone).trim(),
        notes: String(notes).trim()
      });
    });

    return { rows, errors };
  },

  // 3. Export student list to Excel
  exportStudents: (students: Student[]) => {
    const exportData = students.map((s, idx) => ({
      'STT': idx + 1,
      'Mã học sinh': s.code,
      'Họ và tên': s.name,
      'Giới tính': s.gender,
      'Ngày sinh': s.dob,
      'Số điện thoại': s.phone,
      'Địa chỉ': s.address || '',
      'Họ tên phụ huynh': s.parentName || '',
      'SĐT phụ huynh': s.parentPhone || '',
      'Tài khoản đăng nhập': s.code,
      'Mật khẩu khởi tạo': `${s.code}${s.dob.replace(/\D/g, '')}`,
      'Ghi chú': s.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 25 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 30 },
      { wch: 22 },
      { wch: 16 },
      { wch: 20 },
      { wch: 24 },
      { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách học sinh');
    XLSX.writeFile(wb, `Danh_Sach_Hoc_Sinh_${new Date().toISOString().substring(0, 10)}.xlsx`);
  },

  // 4. Download Grade Import Template
  downloadGradeTemplate: (students: Student[], subjects: AppSettings['subjects']) => {
    const sampleRows: any[] = [];
    const activeSubs = subjects.filter(s => s.isActive);

    students.slice(0, 10).forEach(st => {
      activeSubs.slice(0, 3).forEach(sub => {
        sampleRows.push({
          'Mã học sinh': st.code,
          'Họ và tên': st.name,
          'Mã môn': sub.code,
          'Tên môn': sub.name,
          'Học kỳ': 'HK1',
          'Loại kiểm tra': 'TX1',
          'Điểm số / Đánh giá': sub.type === 'score' ? 8.5 : 'Đạt',
          'Ngày đánh giá': new Date().toISOString().substring(0, 10),
          'Ghi chú': 'Kiểm tra thường xuyên'
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 25 },
      { wch: 12 },
      { wch: 20 },
      { wch: 10 },
      { wch: 14 },
      { wch: 18 },
      { wch: 16 },
      { wch: 25 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bang_Diem_Mau');
    XLSX.writeFile(wb, 'Mau_Nhap_Diem_Hoc_Tap.xlsx');
  },

  // 5. Parse Grade Excel
  parseGradeFile: async (file: File) => {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<any>(ws);

    const rows: any[] = [];
    const errors: string[] = [];

    raw.forEach((r, idx) => {
      const rowNum = idx + 2;
      const studentCode = r['Mã học sinh'] || r['Ma HS'] || r['Code'];
      const subjectCode = r['Mã môn'] || r['Ma mon'] || '';
      const subjectName = r['Tên môn'] || r['Ten mon'] || '';
      const semester = r['Học kỳ'] || r['Hoc ky'] || 'HK1';
      const assessmentType = r['Loại kiểm tra'] || r['Loai kiem tra'] || 'TX1';
      const rawScore = r['Điểm số / Đánh giá'] || r['Diem'] || r['Điểm'];
      const note = r['Ghi chú'] || '';
      const date = r['Ngày đánh giá'] || new Date().toISOString().substring(0, 10);

      if (!studentCode) {
        errors.push(`Dòng ${rowNum}: Thiếu mã học sinh`);
        return;
      }
      if (!subjectCode && !subjectName) {
        errors.push(`Dòng ${rowNum}: Thiếu thông tin môn học`);
        return;
      }

      let score: number | undefined = undefined;
      let qualitativeRating: string | undefined = undefined;

      if (typeof rawScore === 'number' || (!isNaN(Number(rawScore)) && rawScore !== '')) {
        const val = Number(rawScore);
        if (val < 0 || val > 10) {
          errors.push(`Dòng ${rowNum}: Điểm số ${val} không hợp lệ (thang điểm 0 - 10)`);
          return;
        }
        score = val;
      } else if (rawScore) {
        qualitativeRating = String(rawScore).trim();
      }

      rows.push({
        studentCode: String(studentCode).trim().toUpperCase(),
        subjectCode: String(subjectCode).trim().toUpperCase(),
        subjectName: String(subjectName).trim(),
        semester,
        assessmentType,
        score,
        qualitativeRating,
        note,
        date
      });
    });

    return { rows, errors };
  },

  // 6. Export Grades
  exportGrades: (grades: GradeRecord[], students: Student[], subjects: AppSettings['subjects']) => {
    const studentMap = new Map(students.map(s => [s.id, s]));
    const subjectMap = new Map(subjects.map(sub => [sub.id, sub]));

    const data = grades.map((g, idx) => {
      const st = studentMap.get(g.studentId);
      const sub = subjectMap.get(g.subjectId);
      return {
        'STT': idx + 1,
        'Mã học sinh': st?.code || g.studentId,
        'Họ và tên': st?.name || '',
        'Môn học': sub?.name || g.subjectId,
        'Học kỳ': g.semester,
        'Loại đánh giá': g.assessmentType,
        'Điểm số': g.score !== undefined ? g.score : '',
        'Đánh giá nhận xét': g.qualitativeRating || '',
        'Ngày đánh giá': g.date,
        'Ghi chú': g.note || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ket_Qua_Hoc_Tap');
    XLSX.writeFile(wb, `Bang_Diem_Lop_${new Date().toISOString().substring(0, 10)}.xlsx`);
  },

  // 7. Export Conduct & Discipline Report
  exportConductReport: (
    students: Student[],
    conductLogs: ConductLog[],
    settings: AppSettings,
    periodName = 'Toàn năm học'
  ) => {
    const baseScore = settings.baseConductScore || 100;
    const scores: Record<string, { total: number; plus: number; minus: number; violations: number }> = {};

    students.forEach(s => {
      scores[s.id] = { total: baseScore, plus: 0, minus: 0, violations: 0 };
    });

    conductLogs.forEach(log => {
      if (scores[log.studentId]) {
        scores[log.studentId].total += log.points;
        if (log.points > 0) {
          scores[log.studentId].plus += log.points;
        } else if (log.points < 0) {
          scores[log.studentId].minus += Math.abs(log.points);
          scores[log.studentId].violations += 1;
        }
      }
    });

    const getTier = (score: number) => {
      if (score >= 90) return 'Tốt';
      if (score >= 75) return 'Khá';
      if (score >= 60) return 'Đạt';
      return 'Cần rèn luyện';
    };

    const data = students.map((s, idx) => {
      const stat = scores[s.id] || { total: baseScore, plus: 0, minus: 0, violations: 0 };
      return {
        'STT': idx + 1,
        'Mã học sinh': s.code,
        'Họ và tên': s.name,
        'Giới tính': s.gender,
        'Điểm ban đầu': baseScore,
        'Tổng điểm cộng': `+${stat.plus}`,
        'Tổng điểm trừ': `-${stat.minus}`,
        'Điểm thi đua hiện tại': stat.total,
        'Số lượt vi phạm': stat.violations,
        'Xếp loại': getTier(stat.total),
        'Lớp': settings.className || '7A1',
        'Năm học': settings.schoolYear || '2025 - 2026'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 25 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bao_Cao_Thi_Dua');
    XLSX.writeFile(wb, `Bao_Cao_Thi_Dua_${settings.className || '7A1'}_${new Date().toISOString().substring(0, 10)}.xlsx`);
  }
};
