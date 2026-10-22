import React, { useState, useEffect } from 'react';
import { AuditEvent } from '../../types.ts';
import { api } from '../../services/api.ts';
import { Modal } from '../../components/Modal.tsx';
import { Shield, Eye, RotateCcw, Filter, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../services/i18n.tsx';

export const AuditLogView: React.FC = () => {
  const { t, language } = useTranslation();
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [filterType, setFilterType] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterType) params.eventType = filterType;
      const data = await api.getAuditLogs(params);
      setLogs(data);
    } catch (err) {
      console.error('Erreur chargement logs audit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterType]);

  const getEventBadgeClass = (type: string) => {
    switch (type) {
      case 'MANUAL_BARRIER_OPEN':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'TRANSACTION_CANCELLED':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'ACCESS_DENIED':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'LOGIN':
      case 'SESSION_OPENED':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      default:
        return 'bg-slate-800 text-slate-300';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span>{t('auditTitle')}</span>
          </h2>
          <p className="text-xs text-slate-400">
            {t('auditSubtitle')}
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5 border border-slate-700"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t('refreshBtn')}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <select
          id="select-audit-filter-type"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
        >
          <option value="">{t('allEventTypes')}</option>
          <option value="MANUAL_BARRIER_OPEN">{language === 'fr' ? 'Ouvertures manuelles de barrière' : 'Manual barrier openings'}</option>
          <option value="TRANSACTION_CANCELLED">{language === 'fr' ? 'Annulations de transaction' : 'Transaction cancellations'}</option>
          <option value="LOGIN">{language === 'fr' ? 'Connexions utilisateurs' : 'User logins'}</option>
          <option value="LOGOUT">{language === 'fr' ? 'Déconnexions' : 'User logouts'}</option>
          <option value="SESSION_OPENED">{language === 'fr' ? 'Ouvertures de caisse' : 'Shift openings'}</option>
          <option value="SESSION_CLOSED">{language === 'fr' ? 'Clôtures de caisse' : 'Shift closings'}</option>
          <option value="TARIFF_UPDATED">{language === 'fr' ? 'Modifications de tarifs' : 'Tariff revisions'}</option>
          <option value="ACCESS_DENIED">{language === 'fr' ? "Tentatives d'accès refusées" : 'Access denied attempts'}</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
            <tr>
              <th className="px-4 py-3">{t('tableTimestampHeader')}</th>
              <th className="px-4 py-3">{t('tableEventTypeHeader')}</th>
              <th className="px-4 py-3">{t('tableOperatorHeader')}</th>
              <th className="px-4 py-3">{t('tableSummaryHeader')}</th>
              <th className="px-4 py-3 text-right">{t('tableDetailsHeader')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {language === 'fr' ? "Aucun événement d'audit enregistré." : 'No audit events recorded.'}
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getEventBadgeClass(log.eventType)}`}>
                      {log.eventType}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-200 whitespace-nowrap">
                    {log.username}
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-[11px] truncate max-w-xs">
                    {JSON.stringify(log.details)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setSelectedEvent(log)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                      title={language === 'fr' ? "Inspecter l'événement" : 'Inspect event'}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: DETAIL AUDIT EVENT */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={t('eventDetailsModalTitle')}
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-800/80 p-4 rounded-xl space-y-2 border border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'ID Événement :' : 'Event ID:'}</span>
                <span className="font-mono text-white">{selectedEvent.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Type :' : 'Type:'}</span>
                <span className="font-bold text-emerald-400">{selectedEvent.eventType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Date et heure :' : 'Date & Time:'}</span>
                <span className="text-white">{new Date(selectedEvent.timestamp).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Opérateur :' : 'Operator:'}</span>
                <span className="text-white font-semibold">{selectedEvent.username} ({selectedEvent.userId})</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 block mb-1 font-semibold">{language === 'fr' ? "Données d'Exploitation Associées (JSON) :" : 'Associated Event Payload (JSON):'}</span>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto">
                {JSON.stringify(selectedEvent.details, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
