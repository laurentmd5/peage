import bcrypt from 'bcryptjs';

export class PasswordService {
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  static async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
