import { createHash, randomBytes } from 'node:crypto';

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const finalSalt = salt ?? randomBytes(16).toString('hex');
  const hash = createHash('sha256')
    .update(password + ':' + finalSalt)
    .digest('hex');
  return { hash, salt: finalSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const result = hashPassword(password, salt);
  return result.hash === hash;
}
