import jwt from 'jsonwebtoken';
import { UserRole } from '../../domain/value-objects/Role.ts';

export interface TokenPayload {
  userId: string;
  username: string;
  role: UserRole;
  fullName: string;
}

export class JwtService {
  private static readonly SECRET: string = process.env.JWT_SECRET || 'peage-secret-token-key-2026';
  private static readonly EXPIRES_IN = '24h';

  static sign(payload: TokenPayload): string {
    return jwt.sign(payload, this.SECRET, { expiresIn: this.EXPIRES_IN });
  }

  static verify(token: string): TokenPayload {
    return jwt.verify(token, this.SECRET) as TokenPayload;
  }
}
