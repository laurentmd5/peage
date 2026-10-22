export enum UserRole {
  ADMIN = 'admin',
  SUPERVISEUR = 'superviseur',
  CAISSIER = 'caissier',
  OPERATEUR = 'operateur',
  MAINTENANCE = 'maintenance'
}

export function isValidRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}
