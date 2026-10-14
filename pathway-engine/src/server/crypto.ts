import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const newId = (prefix: string, bytes = 6) => `${prefix}-${randomBytes(bytes).toString('hex').toUpperCase()}`;
export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** AES-256-GCM for personal data at rest (name, date of birth, notes). */
export class FieldCipher {
  constructor(private key: Buffer) {
    if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes (base64)');
  }
  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return [iv, c.getAuthTag(), body].map((b) => b.toString('base64url')).join('.');
  }
  decrypt(enc: string): string {
    const [iv, tag, body] = enc.split('.').map((s) => Buffer.from(s, 'base64url'));
    const d = createDecipheriv('aes-256-gcm', this.key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString('utf8');
  }
}

/** Stateless staff session: role.expiry.signature */
export class StaffTokens {
  constructor(private secret: string) {}
  issue(role: 'mentor' | 'admin', ttlHours = 12): string {
    const exp = Date.now() + ttlHours * 3_600_000;
    const body = `${role}.${exp}`;
    return `${body}.${createHmac('sha256', this.secret).update(body).digest('base64url')}`;
  }
  verify(token: string): 'mentor' | 'admin' | null {
    const [role, exp, sig] = token.split('.');
    if (!role || !exp || !sig) return null;
    const expected = createHmac('sha256', this.secret).update(`${role}.${exp}`).digest('base64url');
    if (!safeEqual(sig, expected) || Number(exp) < Date.now()) return null;
    return role === 'mentor' || role === 'admin' ? role : null;
  }
}
