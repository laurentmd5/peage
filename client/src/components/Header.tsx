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
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-800/80">
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
            {language === 'fr' ? 'Caissier 1 (Awa)' : 'Cashier 1 (Awa)'}
          </button>
          <button
            onClick={() => onSwitchUser('caissier2')}
            className={`px-2 py-1 rounded transition-colors ${currentUser?.username === 'caissier2' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {language === 'fr' ? 'Caissier 2 (Moussa)' : 'Cashier 2 (Moussa)'}
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

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xl">
            🛣️
          </div>
          <div>
            <h1 className="font-bold text-base text-white flex items-center gap-2">
              {t('appTitle')}
              <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">{t('prototypeV1')}</span>
            </h1>
          </div>
        </div>

        {/* Current Active Session & User Info */}
        <div className="flex items-center gap-3">
          {activeSession ? (
            <div className="bg-slate-800/80 border border-emerald-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <div>
                <div className="font-semibold text-emerald-300">{activeSession.boothId} ({t('boothOpen')})</div>
                <div className="text-[11px] text-slate-400">{t('collectedLabel')} {activeSession.totalCollected.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} FCFA</div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/80 border border-amber-500/30 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <div>
                <div className="font-semibold text-amber-300">{t('boothClosed')}</div>
                <div className="text-[11px] text-slate-400">{t('openSessionPrompt')}</div>
              </div>
            </div>
          )}

          {currentUser && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
              <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
                {currentUser.fullName.charAt(0)}
              </div>
              <div>
                <div className="font-semibold text-slate-200">{currentUser.fullName}</div>
                <div className="text-[11px] text-slate-400 uppercase tracking-wide">
                  {currentUser.role === 'admin' ? (language === 'fr' ? 'Administrateur' : 'Administrator') : currentUser.role === 'superviseur' ? (language === 'fr' ? 'Superviseur' : 'Supervisor') : (language === 'fr' ? 'Caissier' : 'Cashier')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto scrollbar-none border-t border-slate-800">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 border-b-2 ${
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
    </header>
  );
};
