import { UserRole } from '../../domain/value-objects/Role.ts';

export interface LoginRequestDTO {
  username: string;
  password: string;
}

export interface LoginResponseDTO {
  token: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    role: UserRole;
  };
}

export interface UserDTO {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}
