import { describe, it, expect } from 'vitest';
import { User } from '../../../server/src/domain/entities/User.ts';
import { UserRole } from '../../../server/src/domain/value-objects/Role.ts';

describe('User Entity and Permissions', () => {
  const admin = new User('u1', 'admin', 'hash', UserRole.ADMIN, 'Administrateur');
  const superviseur = new User('u2', 'superviseur', 'hash', UserRole.SUPERVISEUR, 'Superviseur');
  const caissier = new User('u3', 'caissier1', 'hash', UserRole.CAISSIER, 'Awa Diop');
  const operateur = new User('u4', 'op1', 'hash', UserRole.OPERATEUR, 'Opérateur');

  it('admin and superviseur can cancel transactions, caissier cannot', () => {
    expect(admin.canCancelTransactions()).toBe(true);
    expect(superviseur.canCancelTransactions()).toBe(true);
    expect(caissier.canCancelTransactions()).toBe(false);
    expect(operateur.canCancelTransactions()).toBe(false);
  });

  it('admin, superviseur, and caissier can open barrier manually in case of emergency', () => {
    expect(admin.canOpenBarrierManually()).toBe(true);
    expect(superviseur.canOpenBarrierManually()).toBe(true);
    expect(caissier.canOpenBarrierManually()).toBe(true);
    expect(operateur.canOpenBarrierManually()).toBe(false);
  });

  it('only admin can manage tariffs and users', () => {
    expect(admin.canManageTariffs()).toBe(true);
    expect(superviseur.canManageTariffs()).toBe(false);
    expect(caissier.canManageTariffs()).toBe(false);

    expect(admin.canManageUsers()).toBe(true);
    expect(superviseur.canManageUsers()).toBe(false);
  });
});
