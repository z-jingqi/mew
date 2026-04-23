/**
 * Password hashing + constant-time compare, Web Crypto only (Workers-safe).
 *
 * PBKDF2-SHA256, 100k iterations, 256-bit derived key, 128-bit random salt.
 * All values stored as base64.
 */

const PBKDF2_ITERATIONS = 100_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;

export function randomSalt(): string {
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

export async function hashPassword(password: string, saltB64: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64ToBytes(saltB64),
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    KEY_BITS,
  );
  return bytesToBase64(new Uint8Array(derived));
}

export async function verifyPassword(
  password: string,
  saltB64: string,
  expectedHashB64: string,
): Promise<boolean> {
  const actual = await hashPassword(password, saltB64);
  return constantTimeEqual(actual, expectedHashB64);
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function randomInviteCode(): string {
  // Human-friendly: 10 chars, ambiguous chars removed.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** ---- helpers ---- */

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}
