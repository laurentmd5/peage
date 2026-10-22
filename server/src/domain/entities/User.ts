import { UserRole } from '../value-objects/Role.ts';

export class User {
  readonly id: string;
  readonly username: string;
  passwordHash: string;
  role: UserRole;
  fullName: string;
  isActive: boolean;
  readonly createdAt: Date;

  constructor(
    id: string,
    username: string,
    passwordHash: string,
    role: UserRole,
    fullName: string,
    isActive: boolean = true,
    createdAt: Date = new Date()
  ) {
    if (!id) throw new Error("L'identifiant utilisateur est requis");
    if (!username) throw new Error("Le nom d'utilisateur est requis");
    if (!passwordHash) throw new Error('Le hash de mot de passe est requis');
    if (!fullName) throw new Error('Le nom complet est requis');

    this.id = id;
    this.username = username.toLowerCase().trim();
    this.passwordHash = passwordHash;
    this.role = role;
    this.fullName = fullName.trim();
    this.isActive = isActive;
    this.createdAt = createdAt;
  }

  canCancelTransactions(): boolean {
    return this.role === UserRole.ADMIN || this.role === UserRole.SUPERVISEUR;
  }

  canOpenBarrierManually(): boolean {
    return this.role === UserRole.ADMIN || this.role === UserRole.SUPERVISEUR || this.role === UserRole.CAISSIER;
  }

  canManageTariffs(): boolean {
    return this.role === UserRole.ADMIN;
  }

  canManageUsers(): boolean {
    return this.role === UserRole.ADMIN;
  }
}
