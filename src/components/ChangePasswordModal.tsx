import React, { useState } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, X, Lock } from 'lucide-react';
import { authApi } from '../services/api';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  userName
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!currentPassword || !newPassword) {
      setMsg({ type: 'error', text: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: 'error', text: 'Xác nhận mật khẩu mới không trùng khớp' });
      return;
    }
    if (newPassword.length < 6) {
      setMsg({ type: 'error', text: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setMsg({ type: 'success', text: 'Đổi mật khẩu thành công!' });
      setTimeout(() => {
        onClose();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setMsg(null);
      }, 1500);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Mật khẩu hiện tại không chính xác' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 space-y-4 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#E06D85] flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Đổi mật khẩu tài khoản</h4>
            <p className="text-xs text-slate-400">{userName}</p>
          </div>
        </div>

        {msg && (
          <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}>
            {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Mật khẩu hiện tại *</label>
            <input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Nhập mật khẩu hiện tại"
              className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Mật khẩu mới *</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Xác nhận mật khẩu mới *</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="w-full px-3 py-2 rounded-xl border border-rose-200 text-slate-800 focus:ring-2 focus:ring-[#E06D85]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-xl bg-[#E06D85] text-white font-bold hover:bg-[#C94C67] disabled:opacity-50"
            >
              {loading ? 'Đang đổi...' : 'Xác nhận đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
