import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DataStoreService } from '../store/store.service';

@Injectable()
export class AuthService {
  constructor(private readonly store: DataStoreService) {}

  login(email: string, password: string) {
    const user = this.store.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const token = randomBytes(32).toString('hex');
    this.store.sessions.set(token, user.id);
    const { password: _password, ...safeUser } = user;
    return { token, user: safeUser };
  }

  authenticate(header?: string) {
    const token = header?.replace(/^Bearer\s+/i, '');
    if (!token) {
      throw new UnauthorizedException('Token ausente.');
    }
    const userId = this.store.sessions.get(token);
    const user = this.store.users.find((item) => item.id === userId);
    if (!user) {
      throw new UnauthorizedException('Sessão inválida.');
    }
    return user;
  }
}
