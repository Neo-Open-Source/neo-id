import type { MessageKey } from '$i18n';

export type Strength = { score: 0 | 1 | 2 | 3; labelKey: MessageKey };

const LABELS: readonly MessageKey[] = [
  'password.weak',
  'password.fair',
  'password.good',
  'password.strong'
];

const MIN_ACCEPTABLE_LENGTH = 10;

function alphabetSize(password: string): number {
  let size = 0;
  if (/[a-z]/.test(password)) size += 26;
  if (/[A-Z]/.test(password)) size += 26;
  if (/\d/.test(password)) size += 10;
  if (/[^A-Za-z0-9]/.test(password)) size += 33;
  return size;
}

function hasRun(password: string, min: number): boolean {
  let run = 1;
  for (let index = 1; index < password.length; index += 1) {
    const delta = password.charCodeAt(index) - password.charCodeAt(index - 1);
    run = delta === 1 || delta === -1 ? run + 1 : 1;
    if (run >= min) return true;
  }
  return false;
}

function adjacentRepeats(password: string): number {
  let repeats = 0;
  for (let index = 1; index < password.length; index += 1) {
    if (password[index] === password[index - 1]) repeats += 1;
  }
  return repeats;
}

function entropyBits(password: string): number {
  const unique = new Set(password).size;
  const bits = password.length * Math.log2(alphabetSize(password) || 1);
  const repeatPenalty = adjacentRepeats(password) * 6 + Math.max(0, password.length - unique * 2);
  return bits - repeatPenalty - (hasRun(password, 4) ? 12 : 0);
}

export function passwordStrength(password: string): Strength {
  if (password.length < 8) return { score: 0, labelKey: LABELS[0] };

  const bits = entropyBits(password);
  let score: 0 | 1 | 2 | 3 = 0;
  if (bits >= 80) score = 3;
  else if (bits >= 60) score = 2;
  else if (bits >= 40) score = 1;

  if (password.length < 12 && score > 2) score = 2;
  if (password.length < MIN_ACCEPTABLE_LENGTH && score > 1) score = 1;

  return { score, labelKey: LABELS[score] };
}

export function isAcceptable(password: string): boolean {
  return (
    password.length >= MIN_ACCEPTABLE_LENGTH &&
    /\d/.test(password) &&
    /[A-Za-z]/.test(password)
  );
}
