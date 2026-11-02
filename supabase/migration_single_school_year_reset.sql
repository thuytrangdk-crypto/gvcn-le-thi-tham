-- ====================================================================
-- SUPABASE SAFE SQL MIGRATION: SINGLE SCHOOL YEAR RESET
-- PROJECT: thuy-trang
-- APPLICATION: GVCN – Quản trị lớp chủ nhiệm
-- MIGRATION: 20261102_single_school_year_reset.sql
--
-- NGUYÊN TẮC: MỖI LẦN CHỈ QUẢN LÝ MỘT NĂM HỌC HIỆN TẠI
--
-- MỤC TIÊU:
-- 1. Bổ sung thủ tục lưu trữ an toàn reset_class_school_year() trên Supabase.
-- 2. Đảm bảo CHỈ GIÁO VIÊN ĐÃ ĐƯỢC PHÊ DUYỆT mới có quyền gọi thủ tục xóa/làm mới.
-- 3. Xóa dữ liệu vận hành cũ của lớp (học sinh, điểm danh, điểm số, thi đua,
--    đánh giá, thông báo, vinh danh, sơ đồ chỗ ngồi).
-- 4. Thu hồi quyền xem lớp của tài khoản học sinh cũ (chuyển về pending).
-- 5. Giữ nguyên 100% tài khoản giáo viên, User UID, vai trò và cấu hình hệ thống.
-- 6. RLS bảo vệ nghiêm ngặt: Học sinh tuyệt đối KHÔNG có quyền DELETE.
-- 7. KHÔNG DROP TABLE, KHÔNG TỰ ĐỘNG THỰC THI CHO ĐẾN KHI GIÁO VIÊN XÁC NHẬN.
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. THỦ TỤC KẾT THÚC NĂM HỌC & KHỞI TẠO NĂM HỌC MỚI (RPC AN TOÀN)
-- ====================================================================
CREATE OR REPLACE FUNCTION public.reset_class_school_year(
    p_current_class_id TEXT,
    p_new_class_name TEXT,
    p_new_school_year TEXT,
    p_new_school_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_teacher_name TEXT;
    v_clean_class_name TEXT;
    v_clean_school_year TEXT;
    v_clean_school_name TEXT;
    v_deleted_students_count INT;
BEGIN
    -- 1. Xác thực người dùng đã đăng nhập
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Từ chối: Yêu cầu đăng nhập tài khoản giáo viên để thực hiện.';
    END IF;

    -- 2. Kiểm tra vai trò giáo viên đã được phê duyệt
    SELECT name INTO v_teacher_name
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'teacher'
      AND approval_status = 'approved';

    IF v_teacher_name IS NULL THEN
        RAISE EXCEPTION 'Từ chối: Chỉ giáo viên đã được phê duyệt mới có quyền kết thúc năm học.';
    END IF;

    -- 3. Kiểm tra quyền phụ trách trên lớp mục tiêu
    IF NOT public.is_teacher_of_class(p_current_class_id) THEN
        RAISE EXCEPTION 'Từ chối: Bạn không có quyền quản lý lớp "%" để thực hiện khởi tạo năm học.', p_current_class_id;
    END IF;

    -- 4. Làm sạch dữ liệu đầu vào
    v_clean_class_name := COALESCE(NULLIF(trim(p_new_class_name), ''), p_current_class_id);
    v_clean_school_year := COALESCE(NULLIF(trim(p_new_school_year), ''), '2026 - 2027');
    v_clean_school_name := COALESCE(NULLIF(trim(p_new_school_name), ''), 'THPT Chuyên Lê Hồng Phong');

    -- 5. XÓA DỮ LIỆU VẬN HÀNH NĂM CŨ CỦA LỚP ĐƯỢC PHÂN CÔNG
    -- 5.1 Xếp loại định kỳ
    DELETE FROM public.period_evaluations WHERE class_id = p_current_class_id;

    -- 5.2 Nhật ký thi đua
    DELETE FROM public.conduct_logs WHERE class_id = p_current_class_id;

    -- 5.3 Bảng điểm
    DELETE FROM public.grades WHERE class_id = p_current_class_id;

    -- 5.4 Điểm danh chuyên cần
    DELETE FROM public.attendance WHERE class_id = p_current_class_id;

    -- 5.5 Vinh danh
    DELETE FROM public.honors WHERE class_id = p_current_class_id;

    -- 5.6 Bảng tin thông báo
    DELETE FROM public.announcements WHERE class_id = p_current_class_id;

    -- 5.7 Thu hồi phân quyền lớp của học sinh cũ (chuyển về pending, gỡ student_id & class_id)
    UPDATE public.profiles
    SET assigned_class_id = NULL,
        student_id = NULL,
        approval_status = 'pending',
        updated_at = timezone('utc'::text, now())
    WHERE assigned_class_id = p_current_class_id
      AND role = 'student';

    -- 5.8 Xóa danh sách học sinh lớp cũ
    DELETE FROM public.students WHERE class_id = p_current_class_id;
    GET DIAGNOSTICS v_deleted_students_count = ROW_COUNT;

    -- 5.9 Làm mới sơ đồ lớp về rỗng
    UPDATE public.seating_layout
    SET seats = '[]'::jsonb,
        updated_at = timezone('utc'::text, now())
    WHERE class_id = p_current_class_id;

    -- 6. CẬP NHẬT CẤU HÌNH LỚP SANG NĂM HỌC MỚI
    UPDATE public.class_settings
    SET class_name = v_clean_class_name,
        school_year = v_clean_school_year,
        school_name = v_clean_school_name,
        updated_at = timezone('utc'::text, now())
    WHERE class_id = p_current_class_id;

    -- 7. CẬP NHẬT BẢN GHI PHÂN CÔNG NĂM HỌC TRONG teacher_assignments
    UPDATE public.teacher_assignments
    SET school_year = v_clean_school_year,
        updated_at = timezone('utc'::text, now())
    WHERE teacher_id = auth.uid()
      AND class_id = p_current_class_id;

    -- 8. ĐỒNG BỘ TRẠNG THÁI VÀO gvcn_v2_state
    INSERT INTO public.gvcn_v2_state (id, class_id, schema_version, school_year, app_state, updated_by)
    VALUES (
        'current_state',
        p_current_class_id,
        '2.1.0',
        v_clean_school_year,
        jsonb_build_object(
            'action', 'reset_school_year',
            'previous_students_count', v_deleted_students_count,
            'new_school_year', v_clean_school_year,
            'reset_by', auth.uid(),
            'reset_at', timezone('utc'::text, now())
        ),
        auth.uid()
    )
    ON CONFLICT (class_id, id) DO UPDATE SET
        school_year = EXCLUDED.school_year,
        app_state = EXCLUDED.app_state,
        updated_by = auth.uid(),
        last_synced_at = timezone('utc'::text, now());

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Đã hoàn tất kết thúc năm học cũ và khởi tạo năm học mới thành công!',
        'class_id', p_current_class_id,
        'class_name', v_clean_class_name,
        'school_year', v_clean_school_year,
        'deleted_students_count', v_deleted_students_count
    );
END;
$$;

-- ====================================================================
-- 2. CẤP QUYỀN THỰC THI CHO HÀM
-- ====================================================================
REVOKE ALL ON FUNCTION public.reset_class_school_year(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_class_school_year(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ====================================================================
-- 3. RÀ SOÁT & ĐẢM BẢO RLS CHỐNG HỌC SINH XÓA DỮ LIỆU
-- ====================================================================
-- RLS đảm bảo chỉ giáo viên phụ trách lớp mới được quyền xóa các bảng vận hành:
-- 1. students: DELETE USING (public.is_teacher_of_class(class_id))
-- 2. seating_layout: DELETE USING (public.is_teacher_of_class(class_id))
-- 3. announcements: DELETE USING (public.is_teacher_of_class(class_id))
-- 4. honors: DELETE USING (public.is_teacher_of_class(class_id))
-- 5. attendance: DELETE USING (public.is_teacher_of_class(class_id))
-- 6. grades: DELETE USING (public.is_teacher_of_class(class_id))
-- 7. conduct_logs: DELETE USING (public.is_teacher_of_class(class_id))
-- 8. period_evaluations: DELETE USING (public.is_teacher_of_class(class_id))
-- Học sinh (role = 'student') hoặc tài khoản pending không có quyền DELETE trên bất kỳ bảng nào!

COMMIT;

SELECT 'MIGRATION THÀNH CÔNG: Đã tạo thủ tục an toàn reset_class_school_year() trên Supabase!' AS ket_qua;
