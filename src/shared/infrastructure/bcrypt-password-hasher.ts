import { Injectable } from '@nestjs/common';
// bcryptjs: the same bcrypt hashes ($2b$, interchangeable with the native module's) in plain
// JavaScript, so installing needs no native build or install script (npm 12 blocks those)
import * as bcrypt from 'bcryptjs';
import { PasswordHasher } from '../domain/password-hasher';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  private readonly saltRounds = 10;

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
