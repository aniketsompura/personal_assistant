const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Short, sortable, path-safe ids such as `p_m1x8k2_4f9a`. Safe as Artifact
 * database document ids (letters, digits, `_` only).
 */
export function newId(prefix: string): string {
  const time = Date.now().toString(36);
  let rand = '';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) rand += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${time}${rand}`;
}

export const SAFE_ID = /^[A-Za-z0-9_\-.~:@+]{1,120}$/;
