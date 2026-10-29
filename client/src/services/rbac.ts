import { UserRole } from '../types.ts';
import { TranslationKey } from './i18n.tsx';

export interface TabDefinition {
  id: string;
  labelKey: TranslationKey;
  defaultLabel: string;
  icon: string;
  roles: string[];
  descriptionFr: string;
}

export const ALL_TABS: TabDefinition[] = [
  {
    id: 'caisse',
    labelKey: 'tabCaisse',
    defaultLabel: 'Poste de Caisse',
    icon: '🚗',
    roles: ['caissier', 'operateur', 'superviseur', 'admin'],
    descriptionFr: 'Enregistrement LAPI, détection gabarit et encaissement en voie'
  },
  {
    id: 'sessions',
    labelKey: 'tabSessions',
    defaultLabel: 'Gestion de Caisse',
    icon: '💰',
    roles: ['caissier', 'operateur', 'superviseur', 'admin'],
    descriptionFr: 'Ouverture de poste, suivi du fond de caisse et clôture de quart'
  },
  {
    id: 'transactions',
    labelKey: 'tabTransactions',
    defaultLabel: 'Transactions',
    icon: '📋',
    roles: ['caissier', 'operateur', 'superviseur', 'admin'],
    descriptionFr: 'Historique des passages, reçus et annulations supervisées'
  },
  {
    id: 'dashboard',
    labelKey: 'tabDashboard',
    defaultLabel: 'Supervision & Trafic',
    icon: '📊',
    roles: ['superviseur', 'admin'],
    descriptionFr: 'Tableau de bord opérationnel, trafic et état des voies en direct'
  },
  {
    id: 'rapports',
    labelKey: 'tabRapports',
    defaultLabel: 'Rapports & Exports',
    icon: '📑',
    roles: ['superviseur', 'admin'],
    descriptionFr: 'Rapports de recettes, bilans financiers journaliers et exports'
  },
  {
    id: 'audit',
    labelKey: 'tabAudit',
    defaultLabel: "Journal d'Audit",
    icon: '🔍',
    roles: ['superviseur', 'admin'],
    descriptionFr: 'Traçabilité des opérations sensibles, barrières manuelles et sécurité'
  },
  {
    id: 'tarifs',
    labelKey: 'tabTarifs',
    defaultLabel: 'Gestion des Tarifs',
    icon: '🏷️',
    roles: ['admin'],
    descriptionFr: 'Configuration de la grille tarifaire officielle par catégorie'
  }
];

export function getDefaultTabForRole(role: string): string {
  switch (role) {
    case 'caissier':
    case 'operateur':
      return 'caisse';
    case 'superviseur':
      return 'dashboard';
    case 'admin':
      return 'dashboard';
    default:
      return 'caisse';
  }
}

export function isTabAllowedForRole(tabId: string, role: string): boolean {
  const tab = ALL_TABS.find(t => t.id === tabId);
  if (!tab) return false;
  return tab.roles.includes(role);
}

export function getAllowedTabsForRole(role: string): TabDefinition[] {
  return ALL_TABS.filter(tab => tab.roles.includes(role));
}

export interface RolePresentation {
  labelFr: string;
  labelEn: string;
  badgeClass: string;
  icon: string;
  spaceTitleFr: string;
  spaceTitleEn: string;
}

export function getRolePresentation(role: string): RolePresentation {
  switch (role) {
    case 'admin':
      return {
        labelFr: 'Administrateur',
        labelEn: 'Administrator',
        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        icon: '🛡️',
        spaceTitleFr: 'Direction & Administration',
        spaceTitleEn: 'Executive & Administration'
      };
    case 'superviseur':
      return {
        labelFr: 'Superviseur',
        labelEn: 'Supervisor',
        badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        icon: '👔',
        spaceTitleFr: "Supervision d'Exploitation",
        spaceTitleEn: 'Operations Supervision'
      };
    case 'caissier':
    case 'operateur':
    default:
      return {
        labelFr: 'Caissier',
        labelEn: 'Cashier',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        icon: '💼',
        spaceTitleFr: 'Poste de Caisse',
        spaceTitleEn: 'Toll Collection Booth'
      };
  }
}
