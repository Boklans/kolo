import * as Linking from 'expo-linking';
import { CustomDeckTargetMode } from '@/stores/useDeckStore';
import { Deck } from '@/types';

export interface SharedDeckPayload {
  v: 1;
  title: string;
  emoji: string;
  targetMode: CustomDeckTargetMode;
  rawText: string;
}

const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8ToBytes(str: string): number[] {
  const encoded = encodeURIComponent(str);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    const ch = encoded[i];
    if (ch === '%') {
      bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(ch.charCodeAt(0));
    }
  }
  return bytes;
}

function bytesToUtf8(bytes: number[]): string {
  let pct = '';
  for (let i = 0; i < bytes.length; i++) {
    pct += '%' + bytes[i].toString(16).padStart(2, '0');
  }
  return decodeURIComponent(pct);
}

function toBase64Url(input: string): string {
  const bytes = utf8ToBytes(input);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (b1 << 16) | (b2 << 8) | b3;
    out += B64_CHARS[(triplet >> 18) & 63];
    out += B64_CHARS[(triplet >> 12) & 63];
    out += i + 1 < bytes.length ? B64_CHARS[(triplet >> 6) & 63] : '';
    out += i + 2 < bytes.length ? B64_CHARS[triplet & 63] : '';
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64Url(encoded: string): string {
  const clean = encoded.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = B64_CHARS.indexOf(clean[i]);
    const c2 = B64_CHARS.indexOf(clean[i + 1] ?? 'A');
    const c3 = i + 2 < clean.length ? B64_CHARS.indexOf(clean[i + 2]) : -1;
    const c4 = i + 3 < clean.length ? B64_CHARS.indexOf(clean[i + 3]) : -1;
    if (c1 < 0 || c2 < 0) throw new Error('Invalid base64url');
    bytes.push((c1 << 2) | (c2 >> 4));
    if (c3 >= 0) bytes.push(((c2 & 15) << 4) | (c3 >> 2));
    if (c4 >= 0) bytes.push(((c3 & 3) << 6) | c4);
  }
  return bytesToUtf8(bytes);
}

export function detectDeckTargetMode(deck: Deck): CustomDeckTargetMode {
  const hasAlias = deck.items.alias.length > 0;
  const hasCroc = deck.items.crocodile.length > 0;
  const hasTaboo = (deck.items.taboo?.length ?? 0) > 0;
  const hasSpy = deck.items.spyLocations.length > 0;

  if (hasTaboo) return 'taboo';
  if (hasSpy) return 'spy';
  if (hasAlias && hasCroc) return 'both';
  if (hasAlias) return 'alias';
  return 'crocodile';
}

export function extractDeckRawLines(deck: Deck): string[] {
  const mode = detectDeckTargetMode(deck);
  if (mode === 'taboo') {
    return (deck.items.taboo ?? []).map(
      (i) => `${i.word}: ${i.forbiddenWords.join(', ')}`
    );
  }
  if (mode === 'spy') {
    return deck.items.spyLocations.map((loc) =>
      loc.roles?.length ? `${loc.name}: ${loc.roles.join(', ')}` : loc.name
    );
  }
  if (deck.items.alias.length > 0) {
    return deck.items.alias.map((i) => i.word);
  }
  return deck.items.crocodile.map((i) => i.phrase);
}

/**
 * Generates a compact Balaka deep link (`balaka://deck?d=...` or web URL on web)
 * so friends can import custom decks in 1 tap.
 */
export function encodeDeckToShareUrl(deck: Deck): string | null {
  try {
    const lines = extractDeckRawLines(deck).slice(0, 120);
    if (lines.length === 0) return null;

    const payload: SharedDeckPayload = {
      v: 1,
      title: deck.title.slice(0, 40),
      emoji: deck.emoji || '🃏',
      targetMode: detectDeckTargetMode(deck),
      rawText: lines.join('\n'),
    };
    const encoded = toBase64Url(JSON.stringify(payload));
    return Linking.createURL('deck', { queryParams: { d: encoded } });
  } catch {
    return null;
  }
}

export function decodeDeckFromUrl(url: string): SharedDeckPayload | null {
  try {
    if (!url || (!url.includes('d=') && !url.includes('deck='))) return null;
    const match = url.match(/(?:[?&#]d=|deck=)([A-Za-z0-9_-]+)/);
    if (!match?.[1]) return null;

    const jsonStr = fromBase64Url(match[1]);
    const parsed = JSON.parse(jsonStr) as Partial<SharedDeckPayload>;
    if (
      !parsed ||
      typeof parsed.title !== 'string' ||
      typeof parsed.rawText !== 'string' ||
      !parsed.rawText.trim()
    ) {
      return null;
    }

    const validModes: CustomDeckTargetMode[] = [
      'alias',
      'crocodile',
      'both',
      'taboo',
      'spy',
    ];
    const targetMode: CustomDeckTargetMode = validModes.includes(
      parsed.targetMode as CustomDeckTargetMode
    )
      ? (parsed.targetMode as CustomDeckTargetMode)
      : 'both';

    return {
      v: 1,
      title: parsed.title.slice(0, 40) || 'Колода друга',
      emoji: typeof parsed.emoji === 'string' && parsed.emoji ? parsed.emoji : '🃏',
      targetMode,
      rawText: parsed.rawText,
    };
  } catch {
    return null;
  }
}
