import React, { useState, useEffect } from 'react';
import { TariffCategory, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import { Modal } from '../../components/Modal.tsx';
import { Edit2, History, Plus, CheckCircle, XCircle, Tag } from 'lucide-react';
import { useTranslation } from '../../services/i18n.tsx';

interface TarifsManagementProps {
  currentUser: User | null;
}

export const TarifsManagement: React.FC<TarifsManagementProps> = ({ currentUser }) => {
  const { t, language, tCategory } = useTranslation();
  const [categories, setCategories] = useState<TariffCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit rate modal
  const [editCategory, setEditCategory] = useState<TariffCategory | null>(null);
  const [newRate, setNewRate] = useState<number>(0);
  const [rateReason, setRateReason] = useState<string>('');

  // History modal
  const [historyCategory, setHistoryCategory] = useState<TariffCategory | null>(null);

  // Create category modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createLabel, setCreateLabel] = useState('');
  const [createRate, setCreateRate] = useState<number>(500);

  const fetchTariffs = async () => {
    setLoading(true);
    try {
      const data = await api.getTariffs();
      setCategories(data);
    } catch (err) {
      console.error('Erreur chargement tarifs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTariffs();
  }, []);

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategory) return;

    try {
      await api.updateTariffRate(editCategory.code, newRate, rateReason);
      setEditCategory(null);
      setRateReason('');
      fetchTariffs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleActive = async (code: string) => {
    try {
      await api.toggleTariffActive(code);
      fetchTariffs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createTariff(createCode, createLabel, createRate);
      setIsCreateModalOpen(false);
      setCreateCode('');
      setCreateLabel('');
      fetchTariffs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-400" />
            <span>{t('tarifsTitle')}</span>
          </h2>
          <p className="text-xs text-slate-400">
            {t('tarifsSubtitle')}
          </p>
        </div>

        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>{t('newCategoryBtn')}</span>
          </button>
        )}
      </div>

      {/* Tariffs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-800 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
            <tr>
              <th className="px-4 py-3">{t('tableCodeHeader')}</th>
              <th className="px-4 py-3">{t('tableLabelHeader')}</th>
              <th className="px-4 py-3">{t('tableCurrentRateHeader')}</th>
              <th className="px-4 py-3">{t('tableActiveHeader')}</th>
              <th className="px-4 py-3">{t('tableRevisionsHeader')}</th>
              <th className="px-4 py-3 text-right">{t('tableModifyHeader')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {categories.map(cat => (
              <tr key={cat.code} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-white">
                  {cat.code}
                </td>
                <td className="px-4 py-3 text-slate-300 font-medium">
                  {tCategory(cat.code, cat.label)}
                </td>
                <td className="px-4 py-3 font-bold text-emerald-400 text-sm">
                  {cat.currentRate.toLocaleString('fr-FR')} FCFA
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                      cat.isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {cat.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    <span>{cat.isActive ? (language === 'fr' ? 'ACTIF' : 'ACTIVE') : (language === 'fr' ? 'DÉSACTIVÉ' : 'DISABLED')}</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setHistoryCategory(cat)}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{cat.history?.length || 1} {language === 'fr' ? 'révision(s)' : 'revision(s)'}</span>
                  </button>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {currentUser?.role === 'admin' && (
                    <>
                      <button
                        onClick={() => {
                          setEditCategory(cat);
                          setNewRate(cat.currentRate);
                          setRateReason('');
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
                        title={language === 'fr' ? 'Modifier tarif' : 'Update rate'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(cat.code)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                      >
                        {cat.isActive ? (language === 'fr' ? 'Désactiver' : 'Disable') : (language === 'fr' ? 'Activer' : 'Enable')}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL: MODIFIER LE TARIF */}
      <Modal
        isOpen={!!editCategory}
        onClose={() => setEditCategory(null)}
        title={t('editTariffModalTitle')}
      >
        <form onSubmit={handleUpdateRate} className="space-y-4">
          <div className="bg-slate-800 p-3 rounded-lg text-xs space-y-1">
            <div>{t('categoryToModify')} <span className="font-bold text-white">[{editCategory?.code}] {tCategory(editCategory?.code, editCategory?.label)}</span></div>
            <div>{t('currentRateLabel')} <span className="font-bold text-emerald-400">{editCategory?.currentRate} FCFA</span></div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('newRateLabel')}
            </label>
            <input
              id="input-new-rate"
              type="number"
              min="0"
              step="50"
              required
              value={newRate}
              onChange={e => setNewRate(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-base font-bold font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('revisionReasonLabel')}
            </label>
            <input
              id="input-rate-reason"
              type="text"
              required
              minLength={3}
              placeholder={language === 'fr' ? 'Ex: Révision tarifaire annuelle, décision ministérielle...' : 'E.g.: Annual tariff revision, ministerial order...'}
              value={rateReason}
              onChange={e => setRateReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditCategory(null)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
            >
              {t('closeBtn')}
            </button>
            <button
              id="btn-confirm-update-rate"
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs"
            >
              {language === 'fr' ? 'Enregistrer le tarif' : 'Save Tariff Rate'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: HISTORIQUE DES TARIFS */}
      <Modal
        isOpen={!!historyCategory}
        onClose={() => setHistoryCategory(null)}
        title={`${t('historyModalTitle')} : ${tCategory(historyCategory?.code, historyCategory?.label)}`}
      >
        <div className="space-y-3">
          <div className="space-y-2">
            {historyCategory?.history?.map((entry, idx) => (
              <div
                key={idx}
                className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-3 text-xs space-y-1"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-400 text-sm">
                    {entry.rate.toLocaleString('fr-FR')} FCFA
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(entry.effectiveDate).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
                  </span>
                </div>
                <div className="text-slate-300 text-[11px]">
                  {language === 'fr' ? 'Modifié par :' : 'Modified by:'} <span className="font-semibold text-white">{entry.changedBy}</span>
                </div>
                {entry.reason && (
                  <div className="text-slate-400 italic text-[11px]">
                    « {entry.reason} »
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* MODAL: NOUVELLE CATÉGORIE */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('createNewCategoryTitle')}
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{language === 'fr' ? 'Code Catégorie *' : 'Category Code *'}</label>
            <input
              type="text"
              required
              placeholder={language === 'fr' ? 'Ex: TUKTUK' : 'E.g.: TUKTUK'}
              value={createCode}
              onChange={e => setCreateCode(e.target.value.toUpperCase())}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{language === 'fr' ? 'Libellé descriptif *' : 'Description Label *'}</label>
            <input
              type="text"
              required
              placeholder={language === 'fr' ? 'Ex: Tricycle motorisé' : 'E.g.: Motorized tricycle'}
              value={createLabel}
              onChange={e => setCreateLabel(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">{language === 'fr' ? 'Tarif (FCFA) *' : 'Rate (FCFA) *'}</label>
            <input
              type="number"
              min="0"
              required
              value={createRate}
              onChange={e => setCreateRate(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-bold"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
            >
              {t('closeBtn')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs"
            >
              {language === 'fr' ? 'Créer la catégorie' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
