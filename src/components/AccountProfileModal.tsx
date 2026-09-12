import React, { useState } from 'react';
import {
  X,
  User,
  KeyRound,
  Mail,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { AdminAccount } from '../types';

interface AccountProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: AdminAccount;
  onUpdateAccount: (updated: AdminAccount) => void;
  onLogout: () => void;
}

export const AccountProfileModal: React.FC<AccountProfileModalProps> = ({
  isOpen,
  onClose,
  account,
  onUpdateAccount,
  onLogout,
}) => {
  // Tabs inside profile modal: 'overview' | 'change-user' | 'change-pass' | 'change-email'
  const [activeSubTab, setActiveSubTab] = useState<
    'general' | 'username' | 'password' | 'email'
  >('general');

  // Change username form state
  const [newUsername, setNewUsername] = useState(account.username);
  const [userPasswordConfirm, setUserPasswordConfirm] = useState('');

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Recovery email state
  const [recoveryEmail, setRecoveryEmail] = useState(account.recoveryEmail);

  // Feedback notifications
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const showNotification = (type: 'success' | 'error', text: string) => {
    if (type === 'success') {
      setSuccessMsg(text);
      setErrorMsg('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setErrorMsg(text);
      setSuccessMsg('');
    }
  };

  // Handle Update Username
  const handleSaveUsername = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmed = newUsername.trim();
    if (!trimmed) {
      showNotification('error', 'Username baru tidak boleh kosong.');
      return;
    }

    if (userPasswordConfirm !== account.password) {
      showNotification('error', 'Password saat ini salah! Harap verifikasi password Anda.');
      return;
    }

    const updated: AdminAccount = {
      ...account,
      username: trimmed,
    };
    onUpdateAccount(updated);
    setUserPasswordConfirm('');
    showNotification('success', `Username berhasil diubah menjadi "${trimmed}"!`);
  };

  // Handle Update Password
  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (currentPassword !== account.password) {
      showNotification('error', 'Password lama yang Anda masukkan tidak sesuai.');
      return;
    }

    if (!newPassword || newPassword.length < 5) {
      showNotification('error', 'Password baru minimal 5 karakter demi keamanan.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotification('error', 'Konfirmasi password baru tidak cocok.');
      return;
    }

    const updated: AdminAccount = {
      ...account,
      password: newPassword,
    };
    onUpdateAccount(updated);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showNotification('success', 'Password berhasil diperbarui! Gunakan password baru saat login berikutnya.');
  };

  // Handle Update Recovery Email
  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmed = recoveryEmail.trim();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      showNotification('error', 'Silakan masukkan alamat email yang valid.');
      return;
    }

    const updated: AdminAccount = {
      ...account,
      recoveryEmail: trimmed,
    };
    onUpdateAccount(updated);
    showNotification(
      'success',
      `Email aktif pemulihan berhasil diperbarui ke ${trimmed}. Email ini kini terhubung saat memilih "Lupa Kata Sandi".`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Profil Akun</h3>
              <p className="text-xs text-slate-500">
                Pengaturan Kredensial, Email Pemulihan & Akses Sistem
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-200 flex gap-2 overflow-x-auto bg-white">
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('general');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'general'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Ringkasan Profil
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('username');
              setNewUsername(account.username);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'username'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Ganti Username
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('password');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'password'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Ganti Sandi
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSubTab('email');
              setRecoveryEmail(account.recoveryEmail);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'email'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Email Pemulihan
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          {/* Notifications */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-800 text-xs animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-800 text-xs animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: General Overview */}
          {activeSubTab === 'general' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Status Akun</span>
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold">
                    Aktif (Super Administrator)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Username Saat Ini</span>
                  <span className="text-xs font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-200">
                    {account.username}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Email Pemulihan</span>
                  <span className="text-xs font-mono font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                    {account.recoveryEmail}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('username')}
                  className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Ganti Username</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Perbarui nama pengguna login</p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('password')}
                  className="p-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
                    <KeyRound className="w-4 h-4 text-emerald-600" />
                    <span>Ganti Sandi</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Ubah kata sandi keamanan</p>
                </button>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-blue-900 text-xs">
                <Mail className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Koneksi Pemulihan Kata Sandi:</p>
                  <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                    Jika Anda atau petugas lain lupa kata sandi di portal masuk, instruksi pemulihan akan dikirimkan ke email aktif: <strong>{account.recoveryEmail}</strong>.
                  </p>
                </div>
              </div>

              {/* Log Out button */}
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out (Keluar Akun)</span>
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-1.5">
                  Data kehadiran, siswa, dan arsip tetap tersimpan aman di sistem.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Ganti Username */}
          {activeSubTab === 'username' && (
            <form onSubmit={handleSaveUsername} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                Username saat ini: <strong className="text-slate-900">{account.username}</strong>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Username Baru
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Contoh: SuperAdmin / KepalaSekolah"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Konfirmasi Password Anda
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={userPasswordConfirm}
                    onChange={(e) => setUserPasswordConfirm(e.target.value)}
                    placeholder="Masukkan password saat ini untuk verifikasi"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Ketik password saat ini untuk mengonfirmasi perubahan username.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Username Baru</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('general')}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Ganti Sandi */}
          {activeSubTab === 'password' && (
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Password Lama
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan password lama"
                    className="w-full pl-9 pr-10 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Password Baru
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 5 karakter"
                    className="w-full pl-9 pr-10 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Ulangi Password Baru
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang password baru"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Password Baru</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('general')}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: Email Pemulihan */}
          {activeSubTab === 'email' && (
            <form onSubmit={handleSaveEmail} className="space-y-4">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
                <strong>Email Aktif Pemulihan:</strong> Alamat email ini terhubung langsung dengan tombol <strong>"Lupa Kata Sandi?"</strong> pada portal masuk login. Jika sewaktu-waktu petugas lupa kata sandi, petunjuk reset sandi akan ditujukan ke email ini.
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Alamat Email Aktif
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="sdn06slemped@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Pastikan email ini aktif dan dapat diakses oleh pihak sekolah / operator.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Email Pemulihan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('general')}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono text-[11px]">Sistem Presensi SD Negeri Karanggintung 06</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white border border-slate-300 rounded-md hover:bg-slate-100 font-medium text-slate-700 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
