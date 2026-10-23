import React, { useState, useEffect } from 'react';
import { DashboardStats, TollTransaction } from '../../types.ts';
import { api } from '../../services/api.ts';
import {
  TrendingUp,
  Car,
  Banknote,
  AlertOctagon,
  ShieldAlert,
  Layers,
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { useTranslation } from '../../services/i18n.tsx';

export const Dashboard: React.FC = () => {
  const { t, language, tCategory } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const getPaymentMethodLabel = (method: string): string => {
    switch (method) {
      case 'ESPECES': return t('cashLabel');
      case 'WAVE': return t('waveLabel');
      case 'ORANGE_MONEY': return t('orangeLabel');
      case 'CARTE': return t('cardLabel');
      case 'RFID': return t('rfidLabel');
      default: return method;
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Subscribe to SSE stream for real-time live updates
    const eventSource = new EventSource('/api/dashboard/events');

    eventSource.addEventListener('transaction:completed', () => {
      fetchStats();
    });

    eventSource.addEventListener('transaction:cancelled', () => {
      fetchStats();
    });

    eventSource.addEventListener('barrier:manual-open', () => {
      fetchStats();
    });

    eventSource.addEventListener('session:opened', () => {
      fetchStats();
    });

    eventSource.addEventListener('session:closed', () => {
      fetchStats();
    });

    eventSource.addEventListener('tariff:updated', () => {
      fetchStats();
    });

    // Also poll every 10s as a fallback
    const interval = setInterval(fetchStats, 10000);

    return () => {
      eventSource.close();
      clearInterval(interval);
    };
  }, []);

  if (loading && !stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-400">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        {language === 'fr' ? 'Chargement des indicateurs temps réel...' : 'Loading real-time indicators...'}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>{t('dashTitle')}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          </h2>
          <p className="text-xs text-slate-400">
            {language === 'fr' ? 'Dernière synchronisation :' : 'Last synchronization:'} {lastUpdated.toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US')} ({t('dashLiveSync')})
          </p>
        </div>

        <button
          onClick={fetchStats}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5 border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t('refreshBtn')}</span>
        </button>
      </div>

      {/* KPI Cards (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Véhicules du jour */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('passagesToday')}</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {stats?.todayVehiclesCount.toLocaleString('fr-FR')}
          </div>
          <div className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{t('nominalFlow')}</span>
          </div>
        </div>

        {/* KPI 2: Recettes journalières */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('revenueToday')}</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {stats?.todayRevenue.toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-400">FCFA</span>
          </div>
          <div className="text-xs text-slate-400">
            {t('activeSessionsCount')} <span className="text-white font-semibold">{stats?.activeSessionsCount}</span>
          </div>
        </div>

        {/* KPI 3: Transactions annulées */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('cancellations')}</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {stats?.todayCancelledCount}
          </div>
          <div className="text-xs text-slate-400">
            {stats?.todayCancelledCount === 0 ? (language === 'fr' ? 'Aucune anomalie' : 'No anomaly') : t('auditVerified')}
          </div>
        </div>

        {/* KPI 4: Ouvertures manuelles */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{t('manualOpenings')}</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white">
            {stats?.todayManualOpeningsCount}
          </div>
          <div className="text-xs text-amber-400">
            {t('justifiedInAudit')}
          </div>
        </div>
      </div>

      {/* Charts & Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Hourly Revenue Bar Chart (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>{t('hourlyRevenueTitle')}</span>
          </h3>

          <div className="space-y-3 pt-2">
            {stats?.revenueByHour.map((item, idx) => {
              const maxRev = Math.max(...(stats?.revenueByHour.map(h => h.revenue) || [1]), 1000);
              const percentage = Math.round((item.revenue / maxRev) * 100);

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-slate-400">{item.hour}</span>
                    <span className="font-semibold text-slate-200">
                      {item.revenue.toLocaleString('fr-FR')} FCFA ({item.count} {language === 'fr' ? 'véh.' : 'veh.'})
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(percentage, item.revenue > 0 ? 3 : 0)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Categories Distribution & Payment Methods (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Categories */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">{t('categoryDistribution')}</h3>

            <div className="space-y-2.5">
              {stats?.categoryDistribution.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">
                      [{cat.code}] {tCategory(cat.code, cat.label)}
                    </span>
                    <span className="font-semibold text-emerald-400">
                      {cat.count} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${cat.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">{t('paymentDistribution')}</h3>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {stats?.paymentDistribution.map((pm, idx) => (
                <div key={idx} className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 space-y-1">
                  <div className="text-slate-400">{getPaymentMethodLabel(pm.method || pm.label)}</div>
                  <div className="font-bold text-white text-sm">
                    {pm.total.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} FCFA
                  </div>
                  <div className="text-[11px] text-slate-400">{pm.count} {language === 'fr' ? 'transactions' : 'transactions'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Live Transactions & Equipment Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Transactions Table (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white">{t('lastPassagesTitle')}</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-800 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2 rounded-l-lg">{language === 'fr' ? 'Heure' : 'Time'}</th>
                  <th className="px-3 py-2">{t('tablePlateHeader')}</th>
                  <th className="px-3 py-2">{t('tableCatHeader')}</th>
                  <th className="px-3 py-2">{t('tableRateHeader')}</th>
                  <th className="px-3 py-2">{t('tableMethodHeader')}</th>
                  <th className="px-3 py-2">{t('tableCashierHeader')}</th>
                  <th className="px-3 py-2 rounded-r-lg">{t('tableStatusHeader')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {stats?.recentTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-3 py-2 text-slate-400 font-mono">
                      {new Date(tx.createdAt).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US')}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-white">
                      {tx.plateNumber}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      [{tx.categoryCode}] {tCategory(tx.categoryCode)}
                    </td>
                    <td className="px-3 py-2 font-bold text-emerald-400">
                      {tx.amountDue.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} FCFA
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {getPaymentMethodLabel(tx.paymentMethod)}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {tx.cashierName}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {tx.status === 'COMPLETED' ? (language === 'fr' ? 'VALIDÉ' : 'COMPLETED') : (language === 'fr' ? 'ANNULÉ' : 'CANCELLED')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Equipment Health Status (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>{t('equipmentSupervisionTitle')}</span>
          </h3>

          <div className="space-y-2 text-xs">
            {[
              { name: t('barrierAuto'), status: stats?.equipmentHealth.barrier },
              { name: t('lapiCam'), status: stats?.equipmentHealth.anprCamera },
              { name: t('loopDetector'), status: stats?.equipmentHealth.loopDetector },
              { name: t('thermalPrinter'), status: stats?.equipmentHealth.receiptPrinter },
              { name: t('posTerminal'), status: stats?.equipmentHealth.paymentTerminal },
              { name: t('rateDisplay'), status: stats?.equipmentHealth.displayPanel }
            ].map((eq, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/60"
              >
                <span className="text-slate-300">{eq.name}</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-400 text-[11px]">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{language === 'fr' ? 'OPÉRATIONNEL' : 'OPERATIONAL'}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
