import React, { useState, useEffect } from 'react';
import { User, CashSession } from './types.ts';
import { api } from './services/api.ts';
import { Header } from './components/Header.tsx';
import { LoginView } from './features/auth/LoginView.tsx';
import { PosteDeCaisse } from './features/caisse/PosteDeCaisse.tsx';
import { Dashboard } from './features/dashboard/Dashboard.tsx';
import { TransactionsList } from './features/transactions/TransactionsList.tsx';
import { TarifsManagement } from './features/tarifs/TarifsManagement.tsx';
import { GestionCaisse } from './features/sessions/GestionCaisse.tsx';
import { RapportsView } from './features/rapports/RapportsView.tsx';
import { AuditLogView } from './features/audit/AuditLogView.tsx';
import { SimulateurConsole } from './features/simulateur/SimulateurConsole.tsx';
import { useTranslation } from './services/i18n.tsx';
import { getDefaultTabForRole, isTabAllowedForRole } from './services/rbac.ts';
import { ShieldAlert } from 'lucide-react';

export const App: React.FC = () => {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>('caisse');
  const [appReady, setAppReady] = useState<boolean>(false);

  // Load current session & user on mount
  const checkAuth = async () => {
    const token = localStorage.getItem('peage_token');
    if (!token) {
      setAppReady(true);
      return;
    }

    try {
      const res = await api.getMe();
      setCurrentUser(res.user);
      const defaultTab = getDefaultTabForRole(res.user.role);
      setActiveTab(defaultTab);

      const session = await api.getActiveCaisse();
      setActiveSession(session);
    } catch (err) {
      localStorage.removeItem('peage_token');
      setCurrentUser(null);
    } finally {
      setAppReady(true);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Guarantee that activeTab is always permitted for the logged-in user's role
  useEffect(() => {
    if (currentUser) {
      if (!isTabAllowedForRole(activeTab, currentUser.role)) {
        setActiveTab(getDefaultTabForRole(currentUser.role));
      }
    }
  }, [currentUser, activeTab]);

  const refreshSession = async () => {
    try {
      const session = await api.getActiveCaisse();
      setActiveSession(session);
    } catch (_) {}
  };

  const handleLoginSuccess = (user: User, _token: string) => {
    setCurrentUser(user);
    setActiveTab(getDefaultTabForRole(user.role));
    refreshSession();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (_) {}
    localStorage.removeItem('peage_token');
    setCurrentUser(null);
    setActiveSession(null);
  };

  if (!appReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const isCurrentTabAuthorized = isTabAllowedForRole(activeTab, currentUser.role);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        currentUser={currentUser}
        activeSession={activeSession}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="flex-1 pb-4">
        {!isCurrentTabAuthorized ? (
          <div className="max-w-md mx-auto my-12 p-8 bg-slate-900 border border-amber-500/30 rounded-2xl text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white">
              {t('unauthorizedAccess')}
            </h3>
            <p className="text-xs text-slate-400">
              Votre rôle actuel ({currentUser.role}) ne vous autorise pas à accéder à ce module.
            </p>
            <button
              onClick={() => setActiveTab(getDefaultTabForRole(currentUser.role))}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              {t('returnToMainWorkspace')}
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'caisse' && (
              <PosteDeCaisse
                currentUser={currentUser}
                activeSession={activeSession}
                onRefreshSession={refreshSession}
              />
            )}

            {activeTab === 'dashboard' && <Dashboard />}

            {activeTab === 'transactions' && (
              <TransactionsList currentUser={currentUser} />
            )}

            {activeTab === 'tarifs' && (
              <TarifsManagement currentUser={currentUser} />
            )}

            {activeTab === 'sessions' && (
              <GestionCaisse
                currentUser={currentUser}
                activeSession={activeSession}
                onRefreshSession={refreshSession}
              />
            )}

            {activeTab === 'rapports' && <RapportsView />}

            {activeTab === 'audit' && <AuditLogView />}

            {activeTab === 'simulateur' && currentUser.role === 'admin' && (
              <SimulateurConsole />
            )}
          </>
        )}
      </main>

      {/* Enterprise Corporate Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 text-center text-xs text-slate-400">
        {t('footerText')}
      </footer>
    </div>
  );
};

export default App;
