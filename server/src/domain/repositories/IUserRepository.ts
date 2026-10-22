import { User } from '../entities/User.ts';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  save(user: User): Promise<void>;
  getAll(): Promise<User[]>;
}
