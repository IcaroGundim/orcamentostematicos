import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DataStoreService } from '../store/store.service';

@Injectable()
export class AuthService {
  constructor(private readonly store: DataStoreService) {}

  async login(email: string, password: string) {
    const user = await this.store.findUserByEmail(email);
    if (!user || user.password !== password) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const token = randomBytes(32).toString('hex');
    await this.store.createSession(token, user.id);
    const { password: _password, ...safeUser } = user;
    return { token, user: safeUser };
  }

  async authenticate(header?: string) {
    const token = header?.replace(/^Bearer\s+/i, '');
    if (!token) {
      throw new UnauthorizedException('Token ausente.');
    }
    const user = await this.store.getUserByToken(token);
    if (!user) {
      throw new UnauthorizedException('Sessão inválida.');
    }
    return user;
  }
}
