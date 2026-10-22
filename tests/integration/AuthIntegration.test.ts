import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../server/src/app.ts';
import { seedDatabase } from '../../server/src/infrastructure/persistence/SeedData.ts';
import { JwtService } from '../../server/src/infrastructure/security/JwtService.ts';

describe('Authentication Integration Tests', () => {
  let appInstance: ReturnType<typeof createApp>;

  beforeEach(async () => {
    appInstance = createApp();
    await seedDatabase(
      appInstance.repos.userRepo,
      appInstance.repos.tariffRepo,
      appInstance.repos.transactionRepo,
      appInstance.repos.sessionRepo,
      appInstance.repos.auditRepo
    );
  });

  it('should authenticate admin user and return JWT token', async () => {
    const user = await appInstance.repos.userRepo.findByUsername('admin');
    expect(user).toBeDefined();

    // Verify token creation
    const token = JwtService.sign({
      userId: user!.id,
      username: user!.username,
      role: user!.role,
      fullName: user!.fullName
    });

    const decoded = JwtService.verify(token);
    expect(decoded.username).toBe('admin');
    expect(decoded.role).toBe('admin');
  });

  it('should list all demo users seeded', async () => {
    const users = await appInstance.repos.userRepo.getAll();
    expect(users.length).toBeGreaterThanOrEqual(4);

    const usernames = users.map(u => u.username);
    expect(usernames).toContain('admin');
    expect(usernames).toContain('superviseur');
    expect(usernames).toContain('caissier1');
    expect(usernames).toContain('caissier2');
  });
});
