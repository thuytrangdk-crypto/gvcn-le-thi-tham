import React, { useState } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  Sparkles,
  AlertCircle,
  X,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import type { AppSettings } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (username: string, pass: string) => Promise<void>;
  settings: AppSettings;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  settings
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Vui lòng nhập tên đăng nhập và mật khẩu');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onLogin(username.trim(), password);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Đăng nhập không thành công');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-rose-100 space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#E06D85] to-[#F7A8B8] text-white flex items-center justify-center mx-auto shadow-md shadow-rose-200">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Đăng nhập hệ thống
          </h3>
          <p className="text-xs text-slate-500">
            {settings.appName || 'GVCN – Quản trị lớp chủ nhiệm'} · Lớp {settings.className}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tên đăng nhập *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Giáo viên (gvcn) hoặc Mã HS (HS01, HS02...)"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-rose-200 text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-[#E06D85]"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Mật khẩu *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-rose-200 text-slate-800 text-xs focus:ring-2 focus:ring-[#E06D85]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-[#E06D85] hover:bg-[#C94C67] text-white text-xs font-bold transition-all shadow-sm shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}</span>
          </button>
        </form>

        {/* Quick Credentials Helper - CHỈ HIỂN THỊ TRONG MÔI TRƯỜNG PHÁT TRIỂN (DEV) */}
        {import.meta.env.DEV && (
          <div className="pt-4 border-t border-rose-100 space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-600 uppercase tracking-wider text-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              Đăng nhập nhanh kiểm thử (Chỉ hiện khi phát triển - DEV)
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('gvcn', 'Gvcn@2026')}
                className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-left transition-colors"
              >
                <div className="font-bold text-[#C94C67]">Giáo viên chủ nhiệm</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">gvcn / Gvcn@2026</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('HS01', 'HS0112032009')}
                className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-left transition-colors"
              >
                <div className="font-bold text-blue-700">Học sinh Nguyễn Văn An</div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">HS01 / HS0112032009</div>
              </button>
            </div>
          </div>
        )}

        <div className="text-[11px] text-slate-400 text-center pt-2 leading-relaxed border-t border-rose-50">
          Học sinh có mật khẩu mặc định là: <strong>Mã học sinh + Ngày sinh (MSDDMMYYYY)</strong>
        </div>
      </div>
    </div>
  );
};
