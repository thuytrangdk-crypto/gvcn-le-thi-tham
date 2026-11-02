import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from environment variables (React/Vite client-side)
// Only Project URL and Publishable Key are required and safe for the client
const supabaseUrl = (
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
) || (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL)) || '';

const supabasePublishableKey = (
  typeof import.meta !== 'undefined' && (
    import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env?.VITE_SUPABASE_ANON_KEY
  )
) || (
  typeof process !== 'undefined' && (
    process.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env?.VITE_SUPABASE_ANON_KEY ||
    process.env?.SUPABASE_PUBLISHABLE_KEY ||
    process.env?.SUPABASE_ANON_KEY
  )
) || '';

export const SUPABASE_PROJECT_NAME = 'thuy-trang';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseUrl.trim() !== '' &&
    !supabaseUrl.includes('your-project-id') &&
    supabasePublishableKey &&
    supabasePublishableKey.trim() !== ''
  );
};

export const getSupabaseConfig = () => {
  return {
    projectName: SUPABASE_PROJECT_NAME,
    isConfigured: isSupabaseConfigured(),
    url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : '',
    hasKey: Boolean(supabasePublishableKey)
  };
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null;

// Health check / test connection
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      message: `Chưa cấu hình biến môi trường VITE_SUPABASE_URL hoặc VITE_SUPABASE_PUBLISHABLE_KEY cho project "${SUPABASE_PROJECT_NAME}".`
    };
  }

  try {
    const { data, error } = await supabase.from('class_settings').select('id').limit(1);
    if (error) {
      if (error.code === '42P01' || error.code === 'PGRST205' || (error.message && error.message.includes('schema cache'))) {
        return {
          success: true,
          message: 'Kết nối mạng và xác thực Supabase THÀNH CÔNG! Tuy nhiên, các bảng dữ liệu chưa được khởi tạo trong SQL Editor (vui lòng chạy file schema.sql bên dưới).',
          details: { tablesCreated: false, error: error.message }
        };
      }
      return {
        success: false,
        message: `Lỗi truy vấn Supabase: ${error.message} (Mã: ${error.code})`,
        details: error
      };
    }
    return {
      success: true,
      message: `Kết nối thành công đến project Supabase "${SUPABASE_PROJECT_NAME}"! Bảng dữ liệu đã sẵn sàng.`,
      details: { tablesCreated: true, data }
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Lỗi mạng hoặc kết nối: ${err.message || err}`
    };
  }
}
