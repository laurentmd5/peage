import React, { useState } from 'react';
import { api } from '../../services/api.ts';
import { User } from '../../types.ts';
import { useTranslation } from '../../services/i18n.tsx';
import { Shield, Lock, User as UserIcon, Radio, ArrowRight, Globe } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { language, setLanguage, t } = useTranslation();
  const [username, setUsername] = useState('caissier1');
  const [password, setPassword] = useState('caisse123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(username, password);
      localStorage.setItem('peage_token', res.token);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.message || t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(u, p);
      localStorage.setItem('peage_token', res.token);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative">
      {/* Top right language switch */}
      <div className="absolute top-6 right-6 flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-lg">
        <button
          onClick={() => setLanguage('fr')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            language === 'fr'
              ? 'bg-emerald-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🇫🇷</span>
          <span>Français</span>
        </button>
        <button
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
            language === 'en'
              ? 'bg-emerald-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>🇬🇧</span>
          <span>English</span>
        </button>
      </div>

      <div className="max-w-md w-full space-y-8">
        {/* Logo and System Title */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto text-emerald-400 font-bold text-3xl shadow-xl shadow-emerald-500/10">
            🛣️
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {t('loginTitle')}
          </h1>
          <p className="text-xs text-slate-400">
            {t('loginSubtitle')}
          </p>
        </div>

        {/* Login Form Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-2xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t('usernameLabel')}
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-username"
                  type="text"
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t('passwordLabel')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all hover:scale-[1.02]"
            >
              <span>{t('loginButton')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* 1-Click Demo Profiles */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              {t('quickProfiles')}
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                id="btn-quick-caissier1"
                type="button"
                onClick={() => quickLogin('caissier1', 'caisse123')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-left rounded-lg border border-slate-700 transition-colors"
              >
                <div className="font-bold text-emerald-400">{language === 'fr' ? 'Caissier 1' : 'Cashier 1'}</div>
                <div className="text-[10px] text-slate-400">{t('cashier1Sub')}</div>
              </button>

              <button
                id="btn-quick-superviseur"
                type="button"
                onClick={() => quickLogin('superviseur', 'super123')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-left rounded-lg border border-slate-700 transition-colors"
              >
                <div className="font-bold text-indigo-400">{language === 'fr' ? 'Superviseur' : 'Supervisor'}</div>
                <div className="text-[10px] text-slate-400">{t('superviseurSub')}</div>
              </button>

              <button
                id="btn-quick-admin"
                type="button"
                onClick={() => quickLogin('admin', 'admin123')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-left rounded-lg border border-slate-700 transition-colors"
              >
                <div className="font-bold text-amber-400">{language === 'fr' ? 'Administrateur' : 'Administrator'}</div>
                <div className="text-[10px] text-slate-400">{t('adminSub')}</div>
              </button>

              <button
                id="btn-quick-caissier2"
                type="button"
                onClick={() => quickLogin('caissier2', 'caisse123')}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-left rounded-lg border border-slate-700 transition-colors"
              >
                <div className="font-bold text-emerald-400">{language === 'fr' ? 'Caissier 2' : 'Cashier 2'}</div>
                <div className="text-[10px] text-slate-400">{t('cashier2Sub')}</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
