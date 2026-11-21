import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';
import { SecretCipher } from '../domain/secret-cipher';

const VERSION = 'v1';
const IV_BYTES = 12;

/** The 32-byte AES key, derived from the secret so the same secret never serves two purposes. */
export function deriveSecretKey(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, '', 'open-helpdesk:secrets:v1', 32));
}

/**
 * AES-256-GCM over the stored secrets, as `v1:<iv>:<tag>:<ciphertext>` in base64url.
 *
 * The key comes from SECRETS_ENCRYPTION_KEY when set, otherwise from JWT_SECRET, so nothing needs
 * configuring. With JWT_SECRET, changing it leaves the saved secrets unreadable: they have to be
 * entered again (decrypt answers null, never throws).
 */
export class AesSecretCipher implements SecretCipher {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = deriveSecretKey(secret);
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join(':');
  }

  decrypt(stored: string): string | null {
    const [version, iv, tag, ciphertext] = stored.split(':');
    if (version !== VERSION || !iv || !tag || ciphertext === undefined) return null;
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}

@Injectable()
export class EnvSecretCipher extends AesSecretCipher {
  constructor(config: ConfigService) {
    super(config.get<string>('SECRETS_ENCRYPTION_KEY') || config.getOrThrow<string>('JWT_SECRET'));
  }
}
