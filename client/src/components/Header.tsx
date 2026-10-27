import React from 'react';
import { User, CashSession } from '../types.ts';
import { useTranslation } from '../services/i18n.tsx';
import { Shield, UserCheck, HardHat, Car, LogOut, Radio, Globe } from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  activeSession: CashSession | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSwitchUser: (username: string) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeSession,
  activeTab,
  onTabChange,
  onSwitchUser,
  onLogout
}) => {
  const { language, setLanguage, t } = useTranslation();

  const tabs = [
    { id: 'caisse', label: t('tabCaisse'), icon: '🚗' },
    { id: 'dashboard', label: t('tabDashboard'), icon: '📊' },
    { id: 'transactions', label: t('tabTransactions'), icon: '📋' },
    { id: 'tarifs', label: t('tabTarifs'), icon: '🏷️' },
    { id: 'sessions', label: t('tabSessions'), icon: '💰' },
    { id: 'rapports', label: t('tabRapports'), icon: '📑' },
    { id: 'audit', label: t('tabAudit'), icon: '🔍' }
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-lg">
      {/* Top Banner */}
      <div className="max-w-[1600px] mx-auto px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-wider text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
            <span>{t('companyName')}</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">{t('centralStation')}</span>
          <span className="text-slate-600">|</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {t('systemOperational')}
          </span>
        </div>

        {/* Quick Profile Switcher & Language Toggle */}
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 mr-2">
            <button
              id="btn-lang-fr"
              onClick={() => setLanguage('fr')}
              className={`px-2 py-0.5 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                language === 'fr'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Passer en Français"
            >
              <span>🇫🇷</span>
              <span>FR</span>
            </button>
            <button
              id="btn-lang-en"
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded text-xs font-bold transition-all flex items-center gap-1 ${
                language === 'en'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Switch to English"
            >
              <span>🇬🇧</span>
              <span>EN</span>
            </button>
          </div>

          <span className="text-slate-400">{t('demoProfile')}</span>
          <button
            onClick={() => onSwitchUser('admin')}
            className={`px-2 py-1 rounded transition-colors ${currentUser?.username === 'admin' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            Admin
          </button>
          <button
            onClick={() => onSwitchUser('superviseur')}
            className={`px-2 py-1 rounded transition-colors ${currentUser?.username === 'superviseur' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {language === 'fr' ? 'Superviseur' : 'Supervisor'}
          </button>
          <button
            onClick={() => onSwitchUser('caissier1')}
            className={`px-2 py-1 rounded transition-colors ${currentUser?.username === 'caissier1' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {language === 'fr' ? 'Caissier 1' : 'Cashier 1'}
          </button>
          <button
            onClick={() => onSwitchUser('caissier2')}
            className={`px-2 py-1 rounded transition-colors ${currentUser?.username === 'caissier2' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {language === 'fr' ? 'Caissier 2' : 'Cashier 2'}
          </button>

          {currentUser && (
            <button
              onClick={onLogout}
              title={t('logout')}
              className="ml-2 text-slate-400 hover:text-red-400 transition-colors p-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs + Compact Session & User Info */}
      <div className="max-w-[1600px] mx-auto px-4 flex items-center justify-between gap-2">
        <nav className="flex gap-1 overflow-x-auto scrollbar-none">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 border-b-2 ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Current Active Session & User Info (Compact Inline) */}
        <div className="hidden md:flex items-center gap-2 py-1 shrink-0">
          {activeSession ? (
            <div className="bg-slate-800/80 border border-emerald-500/30 rounded-lg px-2.5 py-1 flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="font-semibold text-emerald-300">{activeSession.boothId}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300 font-mono">{activeSession.totalCollected.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} FCFA</span>
            </div>
          ) : (
            <div className="bg-slate-800/80 border border-amber-500/30 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="font-semibold text-amber-300">{t('boothClosed')}</span>
            </div>
          )}

          {currentUser && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[11px]">
              <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                {currentUser.fullName.charAt(0)}
              </div>
              <span className="font-semibold text-slate-200">{currentUser.fullName}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
