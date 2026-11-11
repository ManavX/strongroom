/** Random source for drops. Uses the platform CSPRNG so outcomes cannot be nudged by timing. */

const buf = new Uint32Array(8);
let cursor = buf.length;

/** Uniform float in [0, 1). */
export function rand(): number {
  if (cursor >= buf.length) {
    crypto.getRandomValues(buf);
    cursor = 0;
  }
  return buf[cursor++] / 4294967296;
}

export const randInt = (n: number) => Math.floor(rand() * n);

export function pickOne<T>(list: readonly T[]): T {
  return list[randInt(list.length)];
}

export function uid(): string {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  let s = '';
  for (const b of a) s += b.toString(36).padStart(2, '0');
  return s;
}
