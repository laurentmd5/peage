import { IUserRepository } from '../../domain/repositories/IUserRepository.ts';
import { IAuditRepository } from '../../domain/repositories/IAuditRepository.ts';
import { AuditEvent } from '../../domain/entities/AuditEvent.ts';
import { JwtService } from '../../infrastructure/security/JwtService.ts';
import { PasswordService } from '../../infrastructure/security/PasswordService.ts';
import { LoginRequestDTO, LoginResponseDTO, UserDTO } from '../dtos/AuthDTO.ts';

export class AuthUseCases {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly auditRepo: IAuditRepository
  ) {}

  async login(dto: LoginRequestDTO, ipAddress?: string): Promise<LoginResponseDTO> {
    const user = await this.userRepo.findByUsername(dto.username);
    if (!user || !user.isActive) {
      await this.auditRepo.save(
        new AuditEvent(
          `aud-login-fail-${Date.now()}`,
          'ACCESS_DENIED',
          'anonymous',
          dto.username,
          { reason: 'Utilisateur inexistant ou inactif' },
          new Date(),
          ipAddress
        )
      );
      throw new Error('Identifiants invalides');
    }

    const isMatch = await PasswordService.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      await this.auditRepo.save(
        new AuditEvent(
          `aud-login-fail-${Date.now()}`,
          'ACCESS_DENIED',
          user.id,
          user.username,
          { reason: 'Mot de passe erroné' },
          new Date(),
          ipAddress
        )
      );
      throw new Error('Identifiants invalides');
    }

    const token = JwtService.sign({
      userId: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName
    });

    await this.auditRepo.save(
      new AuditEvent(
        `aud-login-${Date.now()}`,
        'LOGIN',
        user.id,
        user.username,
        { role: user.role },
        new Date(),
        ipAddress
      )
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      }
    };
  }

  async logout(userId: string, username: string): Promise<void> {
    await this.auditRepo.save(
      new AuditEvent(
        `aud-logout-${Date.now()}`,
        'LOGOUT',
        userId,
        username,
        { action: 'Déconnexion utilisateur' }
      )
    );
  }

  async listUsers(): Promise<UserDTO[]> {
    const users = await this.userRepo.getAll();
    return users.map(u => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
      createdAt: u.createdAt
    }));
  }
}
