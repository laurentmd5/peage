import { describe, it, expect } from 'vitest';
import {
  ALL_TABS,
  getAllowedTabsForRole,
  isTabAllowedForRole,
  getDefaultTabForRole,
  getRolePresentation
} from '../../client/src/services/rbac.ts';

describe('Role-Based Access Control (RBAC) & Partitioning', () => {
  describe('Tab definitions and security invariants', () => {
    it('should define all 7 required workspace tabs', () => {
      const tabIds = ALL_TABS.map(t => t.id);
      expect(tabIds).toEqual([
        'caisse',
        'sessions',
        'transactions',
        'dashboard',
        'rapports',
        'audit',
        'tarifs'
      ]);
    });
  });

  describe('Caissier / Opérateur access control', () => {
    it('should grant access ONLY to caisse, sessions and transactions', () => {
      const allowed = getAllowedTabsForRole('caissier').map(t => t.id);
      expect(allowed).toEqual(['caisse', 'sessions', 'transactions']);

      expect(isTabAllowedForRole('caisse', 'caissier')).toBe(true);
      expect(isTabAllowedForRole('sessions', 'caissier')).toBe(true);
      expect(isTabAllowedForRole('transactions', 'caissier')).toBe(true);

      // Denied modules
      expect(isTabAllowedForRole('dashboard', 'caissier')).toBe(false);
      expect(isTabAllowedForRole('rapports', 'caissier')).toBe(false);
      expect(isTabAllowedForRole('audit', 'caissier')).toBe(false);
      expect(isTabAllowedForRole('tarifs', 'caissier')).toBe(false);
    });

    it('should assign caisse as the default landing tab for caissier', () => {
      expect(getDefaultTabForRole('caissier')).toBe('caisse');
      expect(getDefaultTabForRole('operateur')).toBe('caisse');
    });

    it('should provide distinctive cashier presentation badge and title', () => {
      const info = getRolePresentation('caissier');
      expect(info.labelFr).toBe('Caissier');
      expect(info.badgeClass).toContain('emerald');
    });
  });

  describe('Superviseur access control', () => {
    it('should grant access to operational supervision and refuse tarif configuration', () => {
      const allowed = getAllowedTabsForRole('superviseur').map(t => t.id);
      expect(allowed).toContain('caisse');
      expect(allowed).toContain('sessions');
      expect(allowed).toContain('transactions');
      expect(allowed).toContain('dashboard');
      expect(allowed).toContain('rapports');
      expect(allowed).toContain('audit');

      // Tarifs is reserved for admin
      expect(allowed).not.toContain('tarifs');
      expect(isTabAllowedForRole('tarifs', 'superviseur')).toBe(false);
    });

    it('should assign dashboard as the default landing tab for superviseur', () => {
      expect(getDefaultTabForRole('superviseur')).toBe('dashboard');
    });

    it('should provide distinctive supervisor presentation badge and title', () => {
      const info = getRolePresentation('superviseur');
      expect(info.labelFr).toBe('Superviseur');
      expect(info.badgeClass).toContain('indigo');
    });
  });

  describe('Administrateur access control', () => {
    it('should grant full access to all workspace tabs including tarifs', () => {
      const allowed = getAllowedTabsForRole('admin').map(t => t.id);
      expect(allowed.length).toBe(7);
      expect(isTabAllowedForRole('tarifs', 'admin')).toBe(true);
      expect(isTabAllowedForRole('audit', 'admin')).toBe(true);
    });

    it('should assign dashboard as default landing tab for admin', () => {
      expect(getDefaultTabForRole('admin')).toBe('dashboard');
    });

    it('should provide distinctive admin presentation badge', () => {
      const info = getRolePresentation('admin');
      expect(info.labelFr).toBe('Administrateur');
      expect(info.badgeClass).toContain('amber');
    });
  });
});
