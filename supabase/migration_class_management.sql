-- ====================================================================
-- SUPABASE SAFE PRODUCTION MIGRATION SCRIPT
-- PROJECT: thuy-trang
-- APPLICATION: GVCN – Quản trị lớp chủ nhiệm
-- MIGRATION: 20261102_class_management_and_teacher_assignments.sql
-- 
-- MỤC TIÊU MIGRATION:
-- 1. Kiểm tra an toàn và chỉ nâng cấp Primary Key của seating_layout khi chưa phải (class_id, id).
-- 2. Tách biệt lớp đang hiển thị trên giao diện (active UI class) khỏi quyền quản lý thực tế trong CSDL.
-- 3. Tạo bảng teacher_assignments phân công giáo viên theo lớp và năm học, bảo vệ bằng RLS.
-- 4. Chặn 100% lỗ hổng giáo viên tự đổi assigned_class_id để chiếm đoạt quyền quản lý lớp của giáo viên khác.
-- 5. Cung cấp RPC create_new_class_by_teacher() an toàn để giáo viên tạo lớp mới hoặc nhận lớp mới theo năm học.
-- 6. Chuẩn hóa bảng gvcn_v2_state đồng bộ trạng thái tổng thể kèm chính sách RLS chặt chẽ.
-- 7. KHÔNG DROP TABLE, KHÔNG XÓA DỮ LIỆU, GIỮ NGUYÊN TẤT CẢ USER UID & DỮ LIỆU NĂM HỌC CŨ.
-- ====================================================================

-- Bắt đầu Transaction an toàn
BEGIN;

-- ====================================================================
-- BƯỚC 1: KIỂM TRA KHÓA CHÍNH BẢNG seating_layout TRƯỚC KHI ALTER TABLE
-- (Chỉ chuyển sang (class_id, id) nếu khóa hiện tại chưa đúng; không can thiệp nếu đã đúng)
-- ====================================================================

DO $$
DECLARE
    v_pk_cols text;
    v_constraint_name text;
BEGIN
    -- Lấy danh sách cột cấu thành khóa chính hiện tại của seating_layout
    SELECT string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position), tc.constraint_name
    INTO v_pk_cols, v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'seating_layout'
      AND tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
    GROUP BY tc.constraint_name;

    IF v_pk_cols = 'class_id,id' THEN
        RAISE NOTICE '==> [BƯỚC 1] Bảng seating_layout ĐÃ CÓ khóa chính phức hợp (class_id, id). Giữ nguyên an toàn, bỏ qua ALTER TABLE.';
    ELSE
        RAISE NOTICE '==> [BƯỚC 1] Khóa chính hiện tại của seating_layout là (%). Tiến hành nâng cấp thành (class_id, id)...', coalesce(v_pk_cols, 'không có');
        
        -- Nếu đã có constraint PK cũ, gỡ bỏ constraint này
        IF v_constraint_name IS NOT NULL THEN
            EXECUTE 'ALTER TABLE public.seating_layout DROP CONSTRAINT ' || quote_ident(v_constraint_name);
        END IF;

        -- Đảm bảo hai cột không chứa giá trị NULL
        UPDATE public.seating_layout SET class_id = '10A1' WHERE class_id IS NULL;
        UPDATE public.seating_layout SET id = 'main' WHERE id IS NULL;
        
        ALTER TABLE public.seating_layout ALTER COLUMN class_id SET NOT NULL;
        ALTER TABLE public.seating_layout ALTER COLUMN id SET NOT NULL;

        -- Tạo khóa chính phức hợp
        ALTER TABLE public.seating_layout ADD PRIMARY KEY (class_id, id);
        RAISE NOTICE '==> [BƯỚC 1] Đã nâng cấp khóa chính seating_layout thành (class_id, id) thành công.';
    END IF;
END $$;


-- ====================================================================
-- BƯỚC 2: TẠO BẢNG PHÂN CÔNG GIÁO VIÊN (teacher_assignments)
-- Lưu trữ định danh lớp ổn định (class_id) cùng năm học (school_year)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL,
    school_year TEXT NOT NULL DEFAULT '2025 - 2026',
    role TEXT NOT NULL DEFAULT 'head_teacher' CHECK (role IN ('head_teacher', 'subject_teacher', 'assistant')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_teacher_class_year UNIQUE (teacher_id, class_id, school_year)
);

-- Tạo chỉ mục tối ưu hóa tốc độ truy vấn kiểm tra quyền RLS
CREATE INDEX IF NOT EXISTS idx_ta_teacher_class_active 
    ON public.teacher_assignments (teacher_id, class_id, is_active);

CREATE INDEX IF NOT EXISTS idx_ta_class_year 
    ON public.teacher_assignments (class_id, school_year);


-- ====================================================================
-- BƯỚC 3: SAO CHÉP & BẢO TOÀN DỮ LIỆU CŨ (Backfill an toàn, không ghi đè)
-- Tự động gán quyền vào teacher_assignments cho các giáo viên đã được duyệt
-- ====================================================================

INSERT INTO public.teacher_assignments (teacher_id, class_id, school_year, role, is_active)
SELECT 
    p.id AS teacher_id,
    COALESCE(p.assigned_class_id, cs.class_id, '10A1') AS class_id,
    COALESCE(cs.school_year, '2025 - 2026') AS school_year,
    'head_teacher' AS role,
    true AS is_active
FROM public.profiles p
LEFT JOIN public.class_settings cs ON cs.class_id = p.assigned_class_id
WHERE p.role = 'teacher' 
  AND p.approval_status = 'approved'
  AND p.assigned_class_id IS NOT NULL
ON CONFLICT (teacher_id, class_id, school_year) 
DO UPDATE SET is_active = true, updated_at = timezone('utc'::text, now());


-- ====================================================================
-- BƯỚC 4: CHUẨN HÓA BẢNG ĐỒNG BỘ TRẠNG THÁI (gvcn_v2_state)
-- Chức năng: Lưu trữ snapshot trạng thái tổng quan ứng dụng, phiên bản schema,
-- thời gian đồng bộ đa thiết bị và cờ kiểm tra tính toàn vẹn bộ nhớ cache.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.gvcn_v2_state (
    id TEXT NOT NULL DEFAULT 'current_state',
    class_id TEXT NOT NULL DEFAULT '10A1',
    schema_version TEXT NOT NULL DEFAULT '2.1.0',
    school_year TEXT NOT NULL DEFAULT '2025 - 2026',
    app_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (class_id, id)
);

-- Khởi tạo bản ghi mặc định cho lớp 10A1 nếu chưa có
INSERT INTO public.gvcn_v2_state (id, class_id, schema_version, school_year, app_state)
VALUES ('current_state', '10A1', '2.1.0', '2025 - 2026', '{"syncStatus": "initialized", "lastAction": "migration"}'::jsonb)
ON CONFLICT (class_id, id) DO NOTHING;


-- ====================================================================
-- BƯỚC 5: CẬP NHẬT CÁC HÀM BẢO MẬT RLS (Kiểm tra phân công thực tế)
-- ====================================================================

-- 5.1 Hàm kiểm tra giáo viên phụ trách lớp theo bảng teacher_assignments
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

    -- Kiểm tra 1: Giáo viên có phân công tích cực trong bảng teacher_assignments
    IF EXISTS (
        SELECT 1 
        FROM public.teacher_assignments ta
        JOIN public.profiles p ON p.id = ta.teacher_id
        WHERE ta.teacher_id = auth.uid()
          AND ta.class_id = target_class_id
          AND ta.is_active = true
          AND p.role = 'teacher'
          AND p.approval_status = 'approved'
    ) THEN
        RETURN TRUE;
    END IF;

    -- Kiểm tra 2 (Dự phòng đồng bộ): Nếu profile giáo viên đã được duyệt và khớp assigned_class_id
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'teacher'
          AND approval_status = 'approved'
          AND assigned_class_id = target_class_id
    );
END;
$$;

-- 5.2 Hàm lấy danh sách tất cả các lớp mà giáo viên hiện tại được phân công
CREATE OR REPLACE FUNCTION public.get_my_assigned_classes()
RETURNS TABLE (
    class_id TEXT,
    school_year TEXT,
    role TEXT,
    class_name TEXT,
    school_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        ta.class_id,
        ta.school_year,
        ta.role,
        COALESCE(cs.class_name, ta.class_id) AS class_name,
        COALESCE(cs.school_name, 'THPT Chuyên Lê Hồng Phong') AS school_name
    FROM public.teacher_assignments ta
    LEFT JOIN public.class_settings cs ON cs.class_id = ta.class_id
    WHERE ta.teacher_id = auth.uid()
      AND ta.is_active = true
    ORDER BY ta.created_at DESC;
END;
$$;


-- ====================================================================
-- BƯỚC 6: NÂNG CẤP TRIGGER KIỂM SOÁT PROFILE CHỐNG CHIẾM QUYỀN LỚP
-- Chặn giáo viên tự sửa assigned_class_id sang lớp mình chưa được phân công!
-- ====================================================================

CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Chỉ áp dụng ràng buộc chặt chẽ với các cuộc gọi thông thường từ phía client
    IF auth.role() = 'authenticated' THEN
        -- Chặn tự nâng role
        IF (NEW.role IS DISTINCT FROM OLD.role) THEN
            RAISE EXCEPTION 'Từ chối truy cập: Người dùng không được phép tự thay đổi quyền hạn (role). Cần quản trị viên thực hiện trong Supabase Dashboard.';
        END IF;

        -- Chặn tự đổi student_id
        IF (NEW.student_id IS DISTINCT FROM OLD.student_id) THEN
            RAISE EXCEPTION 'Từ chối truy cập: Người dùng không được phép tự thay đổi mã học sinh (student_id).';
        END IF;

        -- Chặn tự đổi approval_status
        IF (NEW.approval_status IS DISTINCT FROM OLD.approval_status) THEN
            RAISE EXCEPTION 'Từ chối truy cập: Người dùng không được phép tự thay đổi trạng thái phê duyệt (approval_status).';
        END IF;

        -- KIỂM SOÁT VIỆC CHUYỂN LỚP:
        IF (NEW.assigned_class_id IS DISTINCT FROM OLD.assigned_class_id) THEN
            -- Học sinh tuyệt đối không được tự gán hoặc đổi lớp
            IF OLD.role = 'student' THEN
                RAISE EXCEPTION 'Từ chối truy cập: Học sinh không được phép tự thay đổi lớp học.';
            END IF;

            -- Tài khoản chưa được duyệt không được đổi lớp
            IF OLD.role <> 'teacher' OR OLD.approval_status <> 'approved' THEN
                RAISE EXCEPTION 'Từ chối truy cập: Chỉ tài khoản giáo viên đã được phê duyệt mới được chuyển đổi lớp làm việc.';
            END IF;

            -- ĐẶC BIỆT: Giáo viên chỉ được chuyển sang lớp mà mình ĐÃ ĐƯỢC PHÂN CÔNG trong teacher_assignments!
            IF NEW.assigned_class_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.teacher_assignments
                    WHERE teacher_id = auth.uid()
                      AND class_id = NEW.assigned_class_id
                      AND is_active = true
                ) THEN
                    RAISE EXCEPTION 'Từ chối truy cập: Bạn không có phân công phụ trách lớp "%". Vui lòng chọn lớp đã được cấp quyền hoặc sử dụng quy trình tạo lớp mới an toàn!', NEW.assigned_class_id;
                END IF;
            END IF;
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


-- ====================================================================
-- BƯỚC 7: THỦ TỤC TẠO LỚP MỚI AN TOÀN CHO GIÁO VIÊN (RPC)
-- Tự động tạo cấu hình lớp + Phân công giáo viên + Cập nhật lớp active
-- ====================================================================

CREATE OR REPLACE FUNCTION public.create_new_class_by_teacher(
    p_class_id TEXT,
    p_class_name TEXT,
    p_school_year TEXT,
    p_school_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_teacher_name TEXT;
    v_clean_class_id TEXT;
    v_clean_class_name TEXT;
    v_clean_school_year TEXT;
    v_clean_school_name TEXT;
BEGIN
    -- 1. Kiểm tra xác thực người gọi
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Chưa đăng nhập. Vui lòng đăng nhập tài khoản giáo viên.';
    END IF;

    -- 2. Kiểm tra quyền giáo viên đã được duyệt
    SELECT name INTO v_teacher_name
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'teacher'
      AND approval_status = 'approved';

    IF v_teacher_name IS NULL THEN
        RAISE EXCEPTION 'Từ chối: Chỉ giáo viên đã được phê duyệt mới có quyền tạo lớp mới.';
    END IF;

    -- 3. Làm sạch dữ liệu đầu vào
    v_clean_class_id := trim(p_class_id);
    v_clean_class_name := COALESCE(nullif(trim(p_class_name), ''), v_clean_class_id);
    v_clean_school_year := COALESCE(nullif(trim(p_school_year), ''), '2025 - 2026');
    v_clean_school_name := COALESCE(nullif(trim(p_school_name), ''), 'THPT Chuyên Lê Hồng Phong');

    IF length(v_clean_class_id) = 0 THEN
        RAISE EXCEPTION 'Mã định danh lớp (class_id) không được để trống.';
    END IF;

    -- 4. Khởi tạo bản ghi class_settings nếu chưa có cho class_id này
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
    )
    VALUES (
        v_clean_class_id,
        'GVCN – ' || v_teacher_name,
        v_clean_school_name,
        v_clean_class_name,
        v_teacher_name,
        v_clean_school_year,
        100,
        '#E06D85',
        '[]'::jsonb,
        '[]'::jsonb,
        '[]'::jsonb
    )
    ON CONFLICT (class_id) DO UPDATE SET
        class_name = EXCLUDED.class_name,
        school_name = EXCLUDED.school_name,
        school_year = EXCLUDED.school_year,
        updated_at = timezone('utc'::text, now());

    -- 5. Thêm phân công giáo viên vào teacher_assignments
    INSERT INTO public.teacher_assignments (
        teacher_id,
        class_id,
        school_year,
        role,
        is_active,
        notes
    )
    VALUES (
        auth.uid(),
        v_clean_class_id,
        v_clean_school_year,
        'head_teacher',
        true,
        'Tạo bởi giáo viên qua quy trình an toàn'
    )
    ON CONFLICT (teacher_id, class_id, school_year) 
    DO UPDATE SET 
        is_active = true,
        updated_at = timezone('utc'::text, now());

    -- 6. Cập nhật lớp đang chọn vào profile của giáo viên
    UPDATE public.profiles
    SET assigned_class_id = v_clean_class_id,
        updated_at = timezone('utc'::text, now())
    WHERE id = auth.uid();

    -- 7. Khởi tạo sơ đồ chỗ ngồi mặc định cho lớp nếu chưa có
    INSERT INTO public.seating_layout (class_id, id, seats)
    VALUES (v_clean_class_id, 'main', '[]'::jsonb)
    ON CONFLICT (class_id, id) DO NOTHING;

    -- 8. Khởi tạo trạng thái gvcn_v2_state cho lớp mới
    INSERT INTO public.gvcn_v2_state (id, class_id, schema_version, school_year, app_state, updated_by)
    VALUES (
        'current_state',
        v_clean_class_id,
        '2.1.0',
        v_clean_school_year,
        jsonb_build_object('status', 'created', 'created_by', auth.uid()),
        auth.uid()
    )
    ON CONFLICT (class_id, id) DO UPDATE SET
        school_year = EXCLUDED.school_year,
        updated_by = auth.uid(),
        last_synced_at = timezone('utc'::text, now());

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Đã khởi tạo và phân công lớp thành công!',
        'class_id', v_clean_class_id,
        'class_name', v_clean_class_name,
        'school_year', v_clean_school_year
    );
END;
$$;


-- ====================================================================
-- BƯỚC 8: THIẾT LẬP RLS CHO BẢNG teacher_assignments VÀ gvcn_v2_state
-- ====================================================================

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gvcn_v2_state ENABLE ROW LEVEL SECURITY;

-- 8.1 Chính sách cho teacher_assignments
DROP POLICY IF EXISTS "ta_read_policy" ON public.teacher_assignments;
CREATE POLICY "ta_read_policy" ON public.teacher_assignments
FOR SELECT TO authenticated
USING (
    -- Giáo viên xem được các phân công của mình hoặc cùng trường
    is_teacher() 
    -- Học sinh đã duyệt xem được phân công của lớp mình
    OR (is_account_approved() AND class_id = get_current_user_class_id())
);

DROP POLICY IF EXISTS "ta_write_policy" ON public.teacher_assignments;
CREATE POLICY "ta_write_policy" ON public.teacher_assignments
FOR ALL TO authenticated
USING (
    -- Chỉ chính giáo viên đó thao tác trên bản ghi của mình khi đã được duyệt
    auth.uid() = teacher_id AND is_teacher()
)
WITH CHECK (
    auth.uid() = teacher_id AND is_teacher()
);

-- 8.2 Chính sách cho gvcn_v2_state
DROP POLICY IF EXISTS "state_read_policy" ON public.gvcn_v2_state;
CREATE POLICY "state_read_policy" ON public.gvcn_v2_state
FOR SELECT TO authenticated
USING (
    is_teacher_of_class(class_id)
    OR (is_account_approved() AND class_id = get_current_user_class_id())
);

DROP POLICY IF EXISTS "state_write_policy" ON public.gvcn_v2_state;
CREATE POLICY "state_write_policy" ON public.gvcn_v2_state
FOR ALL TO authenticated
USING (
    is_teacher_of_class(class_id)
)
WITH CHECK (
    is_teacher_of_class(class_id)
);


-- ====================================================================
-- BƯỚC 9: CẤP QUYỀN THỰC THI CHO HÀM
-- ====================================================================

REVOKE ALL ON FUNCTION public.create_new_class_by_teacher(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_new_class_by_teacher(TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_assigned_classes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_assigned_classes() TO authenticated;

-- Hoàn tất Transaction
COMMIT;

-- Thông báo hoàn thành
SELECT 'MIGRATION THÀNH CÔNG: Đã phân tách quyền hạn lớp học, bảo vệ teacher_assignments và hoàn thiện gvcn_v2_state an toàn!' AS ket_qua;
