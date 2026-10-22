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

  const refreshSession = async () => {
    try {
      const session = await api.getActiveCaisse();
      setActiveSession(session);
    } catch (_) {}
  };

  const handleLoginSuccess = (user: User, _token: string) => {
    setCurrentUser(user);
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

  const handleSwitchUser = async (username: string) => {
    const passwords: Record<string, string> = {
      admin: 'admin123',
      superviseur: 'super123',
      caissier1: 'caisse123',
      caissier2: 'caisse123'
    };

    try {
      const res = await api.login(username, passwords[username] || 'caisse123');
      localStorage.setItem('peage_token', res.token);
      setCurrentUser(res.user);
      await refreshSession();
    } catch (err: any) {
      alert(`Erreur bascule profil : ${err.message}`);
    }
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        currentUser={currentUser}
        activeSession={activeSession}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
      />

      <main className="flex-1 pb-16">
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

        {activeTab === 'simulateur' && <SimulateurConsole />}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 text-center text-xs text-slate-500">
        {t('footerText')}
      </footer>
    </div>
  );
};
export default App;
