import React from 'react';
import { User, CashSession } from '../types.ts';
import { useTranslation } from '../services/i18n.tsx';
import { getAllowedTabsForRole, getRolePresentation } from '../services/rbac.ts';
import { LogOut, Radio } from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  activeSession: CashSession | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeSession,
  activeTab,
  onTabChange,
  onLogout
}) => {
  const { language, setLanguage, t } = useTranslation();
  const role = currentUser?.role || 'caissier';
  const roleInfo = getRolePresentation(role);
  const allowedTabs = getAllowedTabsForRole(role);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-lg">
      {/* Top Professional Enterprise Bar */}
      <div className="max-w-[1600px] mx-auto px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-800/80">
        {/* Left: Organization & Site Info */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-black tracking-wider text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse text-emerald-400 shrink-0" />
            <span className="font-mono">{t('companyName')}</span>
          </div>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-slate-400 hidden sm:inline">{t('centralStation')}</span>
          <span className="text-slate-600 hidden md:inline">|</span>
          <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {t('systemOperational')}
          </span>
        </div>

        {/* Right: Authenticated User, Role Badge, Language & Logout */}
        <div className="flex items-center gap-2.5">
          {/* Active Role Badge */}
          {currentUser && (
            <div className={`px-2.5 py-0.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 shadow-sm ${roleInfo.badgeClass}`}>
              <span>{roleInfo.icon}</span>
              <span className="uppercase tracking-wider text-[11px]">
                {language === 'fr' ? roleInfo.labelFr : roleInfo.labelEn}
              </span>
            </div>
          )}

          {/* User Full Name */}
          {currentUser && (
            <div className="hidden lg:flex items-center gap-1.5 text-slate-300 text-xs font-semibold">
              <span className="text-slate-500">|</span>
              <span className="text-slate-200">{currentUser.fullName}</span>
            </div>
          )}

          {/* Language Selector */}
          <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700">
            <button
              id="btn-lang-fr"
              onClick={() => setLanguage('fr')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all flex items-center gap-1 ${
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
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all flex items-center gap-1 ${
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

          {/* Professional Logout Button */}
          {currentUser && (
            <button
              id="btn-logout"
              onClick={onLogout}
              title={t('logout')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500/40 text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Role-Filtered Navigation Tabs + Compact Session Summary */}
      <div className="max-w-[1600px] mx-auto px-4 flex items-center justify-between gap-3">
        {/* Navigation Tabs (Strictly filtered by user's role) */}
        <nav className="flex gap-1 overflow-x-auto scrollbar-none py-0.5">
          {allowedTabs.map(tab => {
            const isActive = activeTab === tab.id;
            const tabLabel = t(tab.labelKey) || tab.defaultLabel;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border-b-2 cursor-pointer ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tabLabel}</span>
              </button>
            );
          })}
        </nav>

        {/* Current Active Session Info Badge (Compact Inline) */}
        <div className="hidden sm:flex items-center gap-2 py-1 shrink-0">
          {activeSession ? (
            <div className="bg-slate-800/90 border border-emerald-500/30 rounded-lg px-2.5 py-1 flex items-center gap-2 text-[11px] font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="font-bold text-emerald-300">{activeSession.boothId}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-200 font-bold">
                {activeSession.totalCollected.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} FCFA
              </span>
            </div>
          ) : (
            <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-slate-500"></span>
              <span className="text-slate-400 font-medium">{t('boothClosed')}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
