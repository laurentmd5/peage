import { IUserRepository } from '../../domain/repositories/IUserRepository.ts';
import { User } from '../../domain/entities/User.ts';

export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const q = username.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.username === q) return u;
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async getAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }
}
