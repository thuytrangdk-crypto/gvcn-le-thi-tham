-- ====================================================================
-- SUPABASE COMPLETE PRODUCTION SCHEMA FOR PROJECT: thuy-trang
-- APPLICATION: GVCN – Lê Thị Thắm (Quản trị lớp chủ nhiệm)
-- PHIÊN BẢN: 2.0 (HOÀN THIỆN) - QUẢN LÝ ĐA LỚP & CHẾ ĐỘ PHÊ DUYỆT TÀI KHOẢN
-- ====================================================================

-- 1. Kích hoạt tiện ích mở rộng UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- CÁC BẢNG DỮ LIỆU CỐT LÕI (CÓ RÀNG BUỘC TOÀN VẸN class_id & student_id)
-- ====================================================================

-- 1. Bảng hồ sơ người dùng (Profiles - Liên kết chặt chẽ với auth.users)
-- ĐẶC BIỆT: Mặc định tài khoản mới có assigned_class_id = NULL và approval_status = 'pending'
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('teacher', 'student')),
    assigned_class_id TEXT DEFAULT NULL, -- NULL khi đăng ký mới; phải được giáo viên/quản trị viên phân lớp
    student_id TEXT DEFAULT NULL, -- NULL nếu chưa liên kết hồ sơ học sinh
    approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Bảng cài đặt lớp học (Class Settings)
CREATE TABLE IF NOT EXISTS public.class_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id TEXT UNIQUE NOT NULL DEFAULT '10A1', -- Mã định danh lớp độc lập
    app_name TEXT DEFAULT 'GVCN – Lê Thị Thắm' NOT NULL,
    school_name TEXT DEFAULT 'THPT Chuyên Lê Hồng Phong' NOT NULL,
    class_name TEXT DEFAULT '10A1' NOT NULL,
    teacher_name TEXT DEFAULT 'Cô Lê Thị Thắm' NOT NULL,
    school_year TEXT DEFAULT '2025 - 2026' NOT NULL,
    base_conduct_score INTEGER DEFAULT 100 NOT NULL,
    accent_color TEXT DEFAULT '#E06D85' NOT NULL,
    conduct_rules JSONB DEFAULT '[]'::jsonb NOT NULL,
    evaluation_tiers JSONB DEFAULT '[]'::jsonb NOT NULL,
    subjects JSONB DEFAULT '[]'::jsonb NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Bảng học sinh (Students - Bảo vệ quyền riêng tư cá nhân & khóa kép)
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY, -- Mã học sinh (ví dụ HS01, HS02...)
    class_id TEXT NOT NULL DEFAULT '10A1',
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('Nam', 'Nữ')) NOT NULL,
    dob TEXT NOT NULL, -- Định dạng DD/MM/YYYY
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    parent_name TEXT DEFAULT '',
    parent_phone TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(class_id, code),
    UNIQUE(id, class_id) -- Khóa phức hợp để ràng buộc toàn vẹn các bảng nghiệp vụ
);

-- 4. Bảng sơ đồ lớp (Seating Layout - Khóa chính phức hợp class_id + id)
-- Cho phép lưu trữ sơ đồ của nhiều lớp mà không bao giờ bị trùng khóa chính!
CREATE TABLE IF NOT EXISTS public.seating_layout (
    class_id TEXT NOT NULL,
    id TEXT NOT NULL DEFAULT 'main',
    seats JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (class_id, id)
);

-- 5. Bảng tin thông báo lớp (Announcements)
CREATE TABLE IF NOT EXISTS public.announcements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    class_id TEXT NOT NULL DEFAULT '10A1',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false NOT NULL,
    is_published BOOLEAN DEFAULT true NOT NULL,
    category TEXT DEFAULT 'Chung' NOT NULL,
    attachment_name TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Bảng vinh danh thành tích (Honors - Ràng buộc khóa ngoại kép student_id + class_id)
CREATE TABLE IF NOT EXISTS public.honors (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    class_id TEXT NOT NULL DEFAULT '10A1',
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    badge TEXT DEFAULT 'trophy' NOT NULL,
    date TEXT NOT NULL,
    is_published BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_honors_student_class FOREIGN KEY (student_id, class_id) 
        REFERENCES public.students(id, class_id) ON DELETE CASCADE
);

-- 7. Bảng điểm danh chuyên cần (Attendance - Chặn điểm danh học sinh lớp khác)
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    class_id TEXT NOT NULL DEFAULT '10A1',
    student_id TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    status TEXT NOT NULL CHECK (status IN ('present', 'excused_absence', 'unexcused_absence', 'late')),
    note TEXT DEFAULT '',
    linked_conduct_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(class_id, student_id, date),
    CONSTRAINT fk_attendance_student_class FOREIGN KEY (student_id, class_id) 
        REFERENCES public.students(id, class_id) ON DELETE CASCADE
);

-- 8. Bảng điểm môn học (Grades - Chặn nhập điểm học sinh lớp khác)
CREATE TABLE IF NOT EXISTS public.grades (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    class_id TEXT NOT NULL DEFAULT '10A1',
    student_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    semester TEXT NOT NULL CHECK (semester IN ('HK1', 'HK2')),
    assessment_type TEXT NOT NULL, -- TX1, TX2, TX3, GK, CK
    score NUMERIC(4,2),
    qualitative_rating TEXT,
    note TEXT DEFAULT '',
    date TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_grades_student_class FOREIGN KEY (student_id, class_id) 
        REFERENCES public.students(id, class_id) ON DELETE CASCADE
);

-- 9. Bảng nhật ký thi đua (Conduct Logs - Chặn cộng/trừ điểm sai lớp)
CREATE TABLE IF NOT EXISTS public.conduct_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    class_id TEXT NOT NULL DEFAULT '10A1',
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    rule_id TEXT,
    rule_code TEXT,
    rule_name TEXT NOT NULL,
    points INTEGER NOT NULL,
    date TEXT NOT NULL,
    note TEXT DEFAULT '',
    synced_attendance_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT fk_conduct_student_class FOREIGN KEY (student_id, class_id) 
        REFERENCES public.students(id, class_id) ON DELETE CASCADE
);

-- 10. Bảng xếp loại định kỳ (Period Evaluations - Chặn xếp loại học sinh lớp khác)
CREATE TABLE IF NOT EXISTS public.period_evaluations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    class_id TEXT NOT NULL DEFAULT '10A1',
    period TEXT NOT NULL, -- YYYY-MM, HK1, HK2, ALL
    student_id TEXT NOT NULL,
    total_score INTEGER NOT NULL,
    calculated_rating TEXT NOT NULL,
    confirmed_rating TEXT,
    reason TEXT DEFAULT '',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(class_id, period, student_id),
    CONSTRAINT fk_evaluations_student_class FOREIGN KEY (student_id, class_id) 
        REFERENCES public.students(id, class_id) ON DELETE CASCADE
);

-- ====================================================================
-- CÁC HÀM BẢO MẬT (SECURITY DEFINER + search_path CỐ ĐỊNH CHỐNG TẤN CÔNG)
-- ====================================================================

-- 1. Kiểm tra tài khoản đã được phê duyệt và gán lớp hay chưa
CREATE OR REPLACE FUNCTION public.is_account_approved()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
          AND approval_status = 'approved'
          AND assigned_class_id IS NOT NULL
    );
END;
$$;

-- 2. Kiểm tra người dùng hiện tại có phải là giáo viên đã duyệt của lớp mục tiêu hay không
CREATE OR REPLACE FUNCTION public.is_teacher_of_class(target_class_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF target_class_id IS NULL OR auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'teacher'
          AND approval_status = 'approved'
          AND assigned_class_id = target_class_id
    );
END;
$$;

-- 3. Kiểm tra quyền giáo viên tổng quát
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
          AND role = 'teacher'
          AND approval_status = 'approved'
    );
END;
$$;

-- 4. Lấy mã học sinh của tài khoản đang đăng nhập (chỉ trả về khi đã được duyệt)
CREATE OR REPLACE FUNCTION public.get_current_student_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    s_id TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT student_id INTO s_id 
    FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'student' 
      AND approval_status = 'approved'
      AND student_id IS NOT NULL;

    RETURN s_id;
END;
$$;

-- 5. Lấy mã lớp của tài khoản đang đăng nhập (CHỈ TRẢ VỀ NẾU ĐÃ ĐƯỢC DUYỆT)
-- Nếu tài khoản ở trạng thái 'pending' hoặc chưa được gán lớp, hàm trả về NULL
CREATE OR REPLACE FUNCTION public.get_current_user_class_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    c_id TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT assigned_class_id INTO c_id 
    FROM public.profiles 
    WHERE id = auth.uid() 
      AND approval_status = 'approved' 
      AND assigned_class_id IS NOT NULL;

    RETURN c_id;
END;
$$;

-- ====================================================================
-- TRIGGERS BẢO VỆ TOÀN VẸN & CHỐNG TỰ NÂNG QUYỀN
-- ====================================================================

-- 6. Trigger chống người dùng tự sửa role, student_id, assigned_class_id hoặc approval_status
CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Khi được gọi từ client thông thường (auth.role() = 'authenticated'):
    IF auth.role() = 'authenticated' THEN
        IF (NEW.role IS DISTINCT FROM OLD.role) THEN
            RAISE EXCEPTION 'Từ chối truy cập: Người dùng không được phép tự thay đổi quyền hạn (role). Cần quản trị viên thực hiện trong Supabase Dashboard.';
        END IF;

        IF (NEW.student_id IS DISTINCT FROM OLD.student_id) THEN
            RAISE EXCEPTION 'Từ chối truy cập: Người dùng không được phép tự thay đổi mã học sinh (student_id).';
        END IF;

        IF (NEW.assigned_class_id IS DISTINCT FROM OLD.assigned_class_id) THEN
            -- Học sinh tuyệt đối không được tự đổi lớp
            IF OLD.role = 'student' THEN
                RAISE EXCEPTION 'Từ chối truy cập: Học sinh không được phép tự gán hoặc đổi lớp (assigned_class_id).';
            END IF;
            -- Giáo viên đã được phê duyệt được phép đổi lớp phụ trách khi có phân công mới
            IF OLD.role <> 'teacher' OR OLD.approval_status <> 'approved' THEN
                RAISE EXCEPTION 'Từ chối truy cập: Chỉ giáo viên đã được phê duyệt mới có quyền cập nhật lớp phụ trách.';
            END IF;
        END IF;

        IF (NEW.approval_status IS DISTINCT FROM OLD.approval_status) THEN
            RAISE EXCEPTION 'Từ chối truy cập: Người dùng không được phép tự thay đổi trạng thái phê duyệt (approval_status).';
        END IF;
    END IF;

    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_profile_role ON public.profiles;
CREATE TRIGGER trg_check_profile_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_profile_role_update();

-- 7. Trigger tạo profile khi người dùng đăng ký mới
-- MẶC ĐỊNH: role = 'student', assigned_class_id = NULL, approval_status = 'pending'
-- KHÔNG tự động gán vào 10A1 và KHÔNG cấp quyền xem dữ liệu bất kỳ lớp nào!
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        role,
        assigned_class_id,
        student_id,
        approval_status,
        name,
        email
    ) VALUES (
        NEW.id,
        'student',
        NULL,      -- Tuyệt đối không tự gán vào lớp 10A1
        NULL,      -- Chưa gán mã học sinh
        'pending', -- Chờ GVCN hoặc Quản trị viên duyệt và phân lớp
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Tài khoản chờ duyệt'),
        NEW.email
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

-- ====================================================================
-- KIỂM SOÁT QUYỀN EXECUTE CHẶT CHẼ
-- ====================================================================
REVOKE ALL ON FUNCTION public.is_teacher_of_class(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_teacher() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_account_approved() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_student_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_class_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_profile_role_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_teacher_of_class(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_approved() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_class_id() TO authenticated;

-- ====================================================================
-- THIẾT LẬP ROW LEVEL SECURITY (RLS) HOÀN CHỈNH CHO 10 BẢNG
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conduct_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_evaluations ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------
-- 1. BẢNG PROFILES
-- - Tài khoản chờ duyệt chỉ xem được hồ sơ của chính mình.
-- - Học sinh chỉ xem được hồ sơ của mình.
-- - Giáo viên chỉ xem hồ sơ của người dùng thuộc lớp mình quản lý (khi đã duyệt).
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT USING (
    auth.uid() = id OR (
        assigned_class_id IS NOT NULL AND public.is_teacher_of_class(assigned_class_id)
    )
);

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE USING (
    auth.uid() = id
) WITH CHECK (
    auth.uid() = id
);

-- --------------------------------------------------------------------
-- 2. BẢNG CLASS_SETTINGS
-- - Tài khoản chưa duyệt (pending) bị CHẶN HOÀN TOÀN (get_current_user_class_id() trả về NULL).
-- - Chỉ tài khoản đã được phê duyệt mới xem cấu hình của đúng lớp mình.
-- - Chỉ Giáo viên của lớp mới có quyền cập nhật cấu hình lớp.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "class_settings_select_policy" ON public.class_settings;
CREATE POLICY "class_settings_select_policy" ON public.class_settings
FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        class_id = public.get_current_user_class_id() OR public.is_teacher_of_class(class_id)
    )
);

DROP POLICY IF EXISTS "class_settings_insert_policy" ON public.class_settings;
CREATE POLICY "class_settings_insert_policy" ON public.class_settings
FOR INSERT WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "class_settings_update_policy" ON public.class_settings;
CREATE POLICY "class_settings_update_policy" ON public.class_settings
FOR UPDATE USING (
    public.is_teacher_of_class(class_id)
) WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "class_settings_delete_policy" ON public.class_settings;
CREATE POLICY "class_settings_delete_policy" ON public.class_settings
FOR DELETE USING (
    public.is_teacher_of_class(class_id)
);

-- --------------------------------------------------------------------
-- 3. BẢNG STUDENTS (BẢO VỆ TUYỆT ĐỐI THÔNG TIN HỌC SINH)
-- - Tài khoản chưa duyệt: BỊ CHẶN 100%.
-- - Học sinh đã duyệt: CHỈ xem được đúng hồ sơ của chính mình trong lớp mình.
-- - Giáo viên: chỉ xem danh sách học sinh thuộc lớp mình phụ trách.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "students_select_policy" ON public.students;
CREATE POLICY "students_select_policy" ON public.students
FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        public.is_teacher_of_class(class_id) OR (
            id = public.get_current_student_id() 
            AND class_id = public.get_current_user_class_id()
            AND public.is_account_approved()
        )
    )
);

DROP POLICY IF EXISTS "students_insert_policy" ON public.students;
CREATE POLICY "students_insert_policy" ON public.students
FOR INSERT WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "students_update_policy" ON public.students;
CREATE POLICY "students_update_policy" ON public.students
FOR UPDATE USING (
    public.is_teacher_of_class(class_id)
) WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "students_delete_policy" ON public.students;
CREATE POLICY "students_delete_policy" ON public.students
FOR DELETE USING (
    public.is_teacher_of_class(class_id)
);

-- --------------------------------------------------------------------
-- 4. BẢNG SEATING_LAYOUT (SƠ ĐỒ CHỖ NGỒI - HỖ TRỢ ĐA LỚP ĐỘC LẬP)
-- - Tài khoản chưa duyệt: BỊ CHẶN 100%.
-- - Thành viên lớp đã duyệt xem sơ đồ đúng lớp của mình.
-- - Giáo viên quản lý sơ đồ lớp mình phụ trách.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "seating_select_policy" ON public.seating_layout;
CREATE POLICY "seating_select_policy" ON public.seating_layout
FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        public.is_teacher_of_class(class_id) 
        OR (class_id = public.get_current_user_class_id() AND public.is_account_approved())
    )
);

DROP POLICY IF EXISTS "seating_insert_policy" ON public.seating_layout;
CREATE POLICY "seating_insert_policy" ON public.seating_layout
FOR INSERT WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "seating_update_policy" ON public.seating_layout;
CREATE POLICY "seating_update_policy" ON public.seating_layout
FOR UPDATE USING (
    public.is_teacher_of_class(class_id)
) WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "seating_delete_policy" ON public.seating_layout;
CREATE POLICY "seating_delete_policy" ON public.seating_layout
FOR DELETE USING (
    public.is_teacher_of_class(class_id)
);

-- --------------------------------------------------------------------
-- 5. BẢNG ANNOUNCEMENTS (BẢNG TIN THÔNG BÁO)
-- - Tài khoản chưa duyệt: BỊ CHẶN 100%.
-- - Học sinh đã duyệt: chỉ xem thông báo đã xuất bản của lớp mình.
-- - Giáo viên: quản lý bài đăng của lớp mình phụ trách.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "announcements_select_policy" ON public.announcements;
CREATE POLICY "announcements_select_policy" ON public.announcements
FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        public.is_teacher_of_class(class_id)
        OR (
            class_id = public.get_current_user_class_id() 
            AND is_published = true 
            AND public.is_account_approved()
        )
    )
);

DROP POLICY IF EXISTS "announcements_insert_policy" ON public.announcements;
CREATE POLICY "announcements_insert_policy" ON public.announcements
FOR INSERT WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "announcements_update_policy" ON public.announcements;
CREATE POLICY "announcements_update_policy" ON public.announcements
FOR UPDATE USING (
    public.is_teacher_of_class(class_id)
) WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "announcements_delete_policy" ON public.announcements;
CREATE POLICY "announcements_delete_policy" ON public.announcements
FOR DELETE USING (
    public.is_teacher_of_class(class_id)
);

-- --------------------------------------------------------------------
-- 6. BẢNG HONORS (VINH DANH)
-- - Tài khoản chưa duyệt: BỊ CHẶN 100%.
-- - Học sinh đã duyệt: chỉ xem vinh danh đã xuất bản của lớp mình.
-- - Giáo viên phụ trách lớp toàn quyền quản lý.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "honors_select_policy" ON public.honors;
CREATE POLICY "honors_select_policy" ON public.honors
FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        public.is_teacher_of_class(class_id)
        OR (
            class_id = public.get_current_user_class_id() 
            AND is_published = true 
            AND public.is_account_approved()
        )
    )
);

DROP POLICY IF EXISTS "honors_insert_policy" ON public.honors;
CREATE POLICY "honors_insert_policy" ON public.honors
FOR INSERT WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "honors_update_policy" ON public.honors;
CREATE POLICY "honors_update_policy" ON public.honors
FOR UPDATE USING (
    public.is_teacher_of_class(class_id)
) WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "honors_delete_policy" ON public.honors;
CREATE POLICY "honors_delete_policy" ON public.honors
FOR DELETE USING (
    public.is_teacher_of_class(class_id)
);

-- --------------------------------------------------------------------
-- 7. BẢNG ATTENDANCE (ĐIỂM DANH CHUYÊN CẦN)
-- - Tài khoản chưa duyệt: BỊ CHẶN 100%.
-- - Giáo viên quản lý điểm danh lớp mình phụ trách.
-- - Học sinh đã duyệt chỉ xem dữ liệu điểm danh của chính mình.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance;
CREATE POLICY "attendance_select_policy" ON public.attendance
FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        public.is_teacher_of_class(class_id) OR (
            student_id = public.get_current_student_id() 
            AND class_id = public.get_current_user_class_id()
            AND public.is_account_approved()
        )
    )
);

DROP POLICY IF EXISTS "attendance_insert_policy" ON public.attendance;
CREATE POLICY "attendance_insert_policy" ON public.attendance
FOR INSERT WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "attendance_update_policy" ON public.attendance;
CREATE POLICY "attendance_update_policy" ON public.attendance
FOR UPDATE USING (
    public.is_teacher_of_class(class_id)
) WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "attendance_delete_policy" ON public.attendance;
CREATE POLICY "attendance_delete_policy" ON public.attendance
FOR DELETE USING (
    public.is_teacher_of_class(class_id)
);

-- --------------------------------------------------------------------
-- 8. BẢNG GRADES (BẢNG ĐIỂM)
-- - Tài khoản chưa duyệt: BỊ CHẶN 100%.
-- - Giáo viên quản lý điểm lớp mình phụ trách.
-- - Học sinh đã duyệt chỉ xem điểm môn của chính mình.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "grades_select_policy" ON public.grades;
CREATE POLICY "grades_select_policy" ON public.grades
FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        public.is_teacher_of_class(class_id) OR (
            student_id = public.get_current_student_id() 
            AND class_id = public.get_current_user_class_id()
            AND public.is_account_approved()
        )
    )
);

DROP POLICY IF EXISTS "grades_insert_policy" ON public.grades;
CREATE POLICY "grades_insert_policy" ON public.grades
FOR INSERT WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "grades_update_policy" ON public.grades;
CREATE POLICY "grades_update_policy" ON public.grades
FOR UPDATE USING (
    public.is_teacher_of_class(class_id)
) WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "grades_delete_policy" ON public.grades;
CREATE POLICY "grades_delete_policy" ON public.grades
FOR DELETE USING (
    public.is_teacher_of_class(class_id)
);

-- --------------------------------------------------------------------
-- 9. BẢNG CONDUCT_LOGS (NHẬT KÝ THI ĐUA)
-- - Tài khoản chưa duyệt: BỊ CHẶN 100%.
-- - Giáo viên quản lý điểm thi đua lớp mình phụ trách.
-- - Học sinh đã duyệt chỉ xem nhật ký thi đua của chính mình.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "conduct_logs_select_policy" ON public.conduct_logs;
CREATE POLICY "conduct_logs_select_policy" ON public.conduct_logs
FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        public.is_teacher_of_class(class_id) OR (
            student_id = public.get_current_student_id() 
            AND class_id = public.get_current_user_class_id()
            AND public.is_account_approved()
        )
    )
);

DROP POLICY IF EXISTS "conduct_logs_insert_policy" ON public.conduct_logs;
CREATE POLICY "conduct_logs_insert_policy" ON public.conduct_logs
FOR INSERT WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "conduct_logs_update_policy" ON public.conduct_logs;
CREATE POLICY "conduct_logs_update_policy" ON public.conduct_logs
FOR UPDATE USING (
    public.is_teacher_of_class(class_id)
) WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "conduct_logs_delete_policy" ON public.conduct_logs;
CREATE POLICY "conduct_logs_delete_policy" ON public.conduct_logs
FOR DELETE USING (
    public.is_teacher_of_class(class_id)
);

-- --------------------------------------------------------------------
-- 10. BẢNG PERIOD_EVALUATIONS (XẾP LOẠI RÈN LUYỆN ĐỊNH KỲ)
-- - Tài khoản chưa duyệt: BỊ CHẶN 100%.
-- - Giáo viên quản lý xếp loại lớp mình phụ trách.
-- - Học sinh đã duyệt chỉ xem xếp loại rèn luyện của chính mình.
-- --------------------------------------------------------------------
DROP POLICY IF EXISTS "evaluations_select_policy" ON public.period_evaluations;
CREATE POLICY "evaluations_select_policy" ON public.period_evaluations
FOR SELECT USING (
    auth.role() = 'authenticated' AND (
        public.is_teacher_of_class(class_id) OR (
            student_id = public.get_current_student_id() 
            AND class_id = public.get_current_user_class_id()
            AND public.is_account_approved()
        )
    )
);

DROP POLICY IF EXISTS "evaluations_insert_policy" ON public.period_evaluations;
CREATE POLICY "evaluations_insert_policy" ON public.period_evaluations
FOR INSERT WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "evaluations_update_policy" ON public.period_evaluations;
CREATE POLICY "evaluations_update_policy" ON public.period_evaluations
FOR UPDATE USING (
    public.is_teacher_of_class(class_id)
) WITH CHECK (
    public.is_teacher_of_class(class_id)
);

DROP POLICY IF EXISTS "evaluations_delete_policy" ON public.period_evaluations;
CREATE POLICY "evaluations_delete_policy" ON public.period_evaluations
FOR DELETE USING (
    public.is_teacher_of_class(class_id)
);

-- ====================================================================
-- KHỞI TẠO CẤU HÌNH LỚP MẪU (KHÔNG TẠO DỮ LIỆU CÁ NHÂN HỌC SINH THẬT)
-- ====================================================================
INSERT INTO public.class_settings (
    class_id,
    app_name,
    school_name,
    class_name,
    teacher_name,
    school_year,
    base_conduct_score,
    accent_color,
    conduct_rules,
    evaluation_tiers,
    subjects
) VALUES (
    '10A1',
    'GVCN – Lê Thị Thắm',
    'THPT Chuyên Lê Hồng Phong',
    '10A1',
    'Cô Lê Thị Thắm',
    '2025 - 2026',
    100,
    '#E06D85',
    '[
        {"id": "R01", "code": "TC-01", "name": "Đạt điểm 9-10 kiểm tra hoặc phát biểu xuất sắc", "points": 5, "category": "Học tập"},
        {"id": "R02", "code": "TC-02", "name": "Tích cực tham gia vệ sinh lớp, giữ gìn tài sản chung", "points": 3, "category": "Nề nếp"},
        {"id": "R03", "code": "TC-03", "name": "Tham gia đội tuyển học sinh giỏi hoặc thi đấu thể thao", "points": 10, "category": "Hoạt động phong trào"},
        {"id": "R04", "code": "TC-04", "name": "Giúp đỡ bạn tiến bộ trong học tập", "points": 5, "category": "Học tập"},
        {"id": "R05", "code": "TR-01", "name": "Đi học muộn", "points": -2, "category": "Chuyên cần", "linkAttendance": true, "attendanceStatus": "late"},
        {"id": "R06", "code": "TR-02", "name": "Nghỉ học không phép", "points": -5, "category": "Chuyên cần", "linkAttendance": true, "attendanceStatus": "unexcused_absence"},
        {"id": "R07", "code": "TR-03", "name": "Không chuẩn bị bài / không làm bài tập về nhà", "points": -3, "category": "Học tập"},
        {"id": "R08", "code": "TR-04", "name": "Vi phạm đồng phục / tác phong", "points": -2, "category": "Nề nếp"},
        {"id": "R09", "code": "TR-05", "name": "Làm mất trật tự trong giờ học", "points": -3, "category": "Nề nếp"}
    ]'::jsonb,
    '[
        {"rating": "Tốt", "minScore": 90},
        {"rating": "Khá", "minScore": 75},
        {"rating": "Đạt", "minScore": 60},
        {"rating": "Cần rèn luyện", "minScore": 0}
    ]'::jsonb,
    '[
        {"id": "SUB-TOAN", "code": "TOAN", "name": "Toán học", "type": "score", "isActive": true, "order": 1},
        {"id": "SUB-VAN", "code": "VAN", "name": "Ngữ văn", "type": "score", "isActive": true, "order": 2},
        {"id": "SUB-ANH", "code": "ANH", "name": "Tiếng Anh", "type": "score", "isActive": true, "order": 3},
        {"id": "SUB-LY", "code": "LY", "name": "Vật lí", "type": "score", "isActive": true, "order": 4},
        {"id": "SUB-HOA", "code": "HOA", "name": "Hóa học", "type": "score", "isActive": true, "order": 5},
        {"id": "SUB-SINH", "code": "SINH", "name": "Sinh học", "type": "score", "isActive": true, "order": 6},
        {"id": "SUB-SU", "code": "SU", "name": "Lịch sử", "type": "score", "isActive": true, "order": 7},
        {"id": "SUB-DIA", "code": "DIA", "name": "Địa lí", "type": "score", "isActive": true, "order": 8},
        {"id": "SUB-GDCD", "code": "GDCD", "name": "Giáo dục kinh tế & pháp luật", "type": "score", "isActive": true, "order": 9},
        {"id": "SUB-TIN", "code": "TIN", "name": "Tin học", "type": "score", "isActive": true, "order": 10},
        {"id": "SUB-TD", "code": "TD", "name": "Giáo dục thể chất", "type": "qualitative", "isActive": true, "order": 11},
        {"id": "SUB-HDTN", "code": "HDTN", "name": "Hoạt động trải nghiệm, hướng nghiệp", "type": "qualitative", "isActive": true, "order": 12}
    ]'::jsonb
) ON CONFLICT (class_id) DO UPDATE SET
    updated_at = timezone('utc'::text, now());
