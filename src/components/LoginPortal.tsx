import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  Mail,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { AdminAccount, SchoolProfile } from '../types';

interface LoginPortalProps {
  school: SchoolProfile;
  account: AdminAccount;
  onLoginSuccess: (username: string, rememberMe: boolean) => void;
  onUpdateAccount: (updated: AdminAccount) => void;
}

export const LoginPortal: React.FC<LoginPortalProps> = ({
  school,
  account,
  onLoginSuccess,
  onUpdateAccount,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password view state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [recoveryEmailInput, setRecoveryEmailInput] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'input' | 'verify' | 'new_password' | 'success'>('input');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  // Mask email for privacy (e.g., sdn06***@gmail.com)
  const maskEmail = (email: string) => {
    if (!email || !email.includes('@')) return email;
    const [name, domain] = email.split('@');
    if (name.length <= 3) return `${name[0]}***@${domain}`;
    return `${name.slice(0, 4)}***@${domain}`;
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg('Silakan masukkan Username dan Password.');
      return;
    }

    setIsSubmitting(true);

    // Validate with account stored credentials (case-insensitive for username)
    const validUsername = cleanUser.toLowerCase() === account.username.toLowerCase();
    const validPassword = cleanPass === account.password;

    setTimeout(() => {
      if (validUsername && validPassword) {
        onLoginSuccess(account.username, rememberMe);
      } else {
        setIsSubmitting(false);
        setErrorMsg('Username atau Password salah. Periksa kembali huruf besar dan kecil.');
      }
    }, 200);
  };

  // Handle forgot password verification
  const handleVerifyEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');

    const trimmed = recoveryEmailInput.trim().toLowerCase();
    const registeredEmail = account.recoveryEmail.trim().toLowerCase();

    if (!trimmed) {
      setRecoveryError('Silakan ketikkan alamat email aktif.');
      return;
    }

    if (trimmed !== registeredEmail) {
      setRecoveryError(`Email tidak cocok dengan email aktif yang terdaftar di Profil Akun.`);
      return;
    }

    setRecoveryStep('new_password');
    setRecoverySuccess('Email terverifikasi. Silakan buat password baru.');
  };

  // Handle setting new password from recovery
  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');

    if (!newPassword || newPassword.length < 5) {
      setRecoveryError('Password baru minimal 5 karakter.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setRecoveryError('Konfirmasi password tidak cocok.');
      return;
    }

    const updatedAccount: AdminAccount = {
      ...account,
      password: newPassword,
    };
    onUpdateAccount(updatedAccount);
    setRecoveryStep('success');
  };

  const handleSendEmailClient = () => {
    const subject = encodeURIComponent(`Permintaan Pemulihan Sandi - ${school.schoolName}`);
    const body = encodeURIComponent(
      `Halo Administrator,\n\nIni adalah permintaan bantuan pemulihan kata sandi sistem presensi untuk sekolah: ${school.schoolName}.\nUsername terdaftar: ${account.username}\n\nSilakan gunakan opsi verifikasi email pada aplikasi untuk memperbarui sandi.`
    );
    window.location.href = `mailto:${account.recoveryEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans text-slate-800">
      <div className="w-full max-w-sm relative z-10 space-y-4">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8 space-y-5">
          {/* Logo and Clean Title */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 p-1.5 flex items-center justify-center shadow-xs">
              {school.logoUrl ? (
                <img
                  src={school.logoUrl}
                  alt={school.schoolName}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <GraduationCap className="w-8 h-8" />
                </div>
              )}
            </div>

            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {school.schoolName}
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Portal Masuk Presensi Barcode
              </p>
            </div>
          </div>

          {!isForgotPassword ? (
            /* CLEAN LOGIN FORM */
            <form onSubmit={handleLoginSubmit} className="space-y-4 pt-1">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Clean Username */}
              <div className="space-y-1">
                <label
                  htmlFor="login-user"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Username
                </label>
                <input
                  id="login-user"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Clean Password */}
              <div className="space-y-1">
                <label
                  htmlFor="login-pass"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-pass"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Clean Login Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-400 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Login</span>
                )}
              </button>

              {/* Forgot Password Link & Keep Logged In */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>Ingat Saya</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setRecoveryStep('input');
                    setRecoveryError('');
                    setRecoverySuccess('');
                    setRecoveryEmailInput('');
                  }}
                  className="text-emerald-700 hover:text-emerald-800 hover:underline font-medium cursor-pointer"
                >
                  Lupa Kata Sandi?
                </button>
              </div>
            </form>
          ) : (
            /* FORGOT PASSWORD SECTION CONNECTED TO ACTIVE EMAIL */
            <div className="space-y-4 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-sm font-bold text-slate-900">Pemulihan Kata Sandi</h2>
              </div>

              {recoveryError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{recoveryError}</span>
                </div>
              )}

              {recoverySuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-800 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>{recoverySuccess}</span>
                </div>
              )}

              {recoveryStep === 'input' && (
                <form onSubmit={handleVerifyEmail} className="space-y-3.5">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">
                      Terhubung dengan Email Profil Akun
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Petunjuk sandi terhubung ke email aktif: <strong>{maskEmail(account.recoveryEmail)}</strong>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Ketikkan Email Aktif Anda
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="email"
                        required
                        autoFocus
                        value={recoveryEmailInput}
                        onChange={(e) => setRecoveryEmailInput(e.target.value)}
                        placeholder={account.recoveryEmail || 'sdn06slemped@gmail.com'}
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Masukkan alamat email pemulihan yang aktif di Profil Akun.
                    </p>
                  </div>

                  <div className="space-y-2 pt-1">
                    <button
                      type="submit"
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Verifikasi & Buat Sandi Baru
                    </button>

                    <button
                      type="button"
                      onClick={handleSendEmailClient}
                      className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kirim Bantuan ke Email Saya</span>
                    </button>
                  </div>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Kembali ke Login
                    </button>
                  </div>
                </form>
              )}

              {recoveryStep === 'new_password' && (
                <form onSubmit={handleResetPassword} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Kata Sandi Baru
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        required
                        autoFocus
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimal 5 karakter"
                        className="w-full pl-3 pr-9 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Ulangi Kata Sandi Baru
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Ulangi sandi baru"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Perbarui Kata Sandi</span>
                  </button>
                </form>
              )}

              {recoveryStep === 'success' && (
                <div className="text-center space-y-3 py-2">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Kata Sandi Berhasil Diperbarui!</h3>
                  <p className="text-xs text-slate-500">
                    Silakan gunakan password baru Anda untuk masuk ke sistem presensi.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setPassword('');
                    }}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Kembali ke Form Login
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clean subtle footer */}
        <div className="text-center text-[11px] text-slate-400">
          SD Negeri Karanggintung 06 • Presensi Barcode
        </div>
      </div>
    </div>
  );
};
