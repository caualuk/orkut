import type { Tone } from './social.models';

const TONES: readonly Tone[] = [
  'teal',
  'purple',
  'coral',
  'blue',
  'orange',
  'slate',
  'lavender',
  'green',
  'peach',
  'yellow',
  'pink',
];

/** Cor estável por pessoa/comunidade: o mesmo id sempre gera o mesmo gradiente. */
export function toneFor(id: string): Tone {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TONES[Math.abs(hash) % TONES.length] ?? 'gray';
}

/** Iniciais do tile 3D: "Ana Lima" → "AL"; nome único → duas primeiras letras. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toLocaleUpperCase('pt-BR');
  return `${parts[0]?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toLocaleUpperCase('pt-BR');
}

export const firstNameOf = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "agora", "há 5 min", "há 2 h", "ontem", "há 3 dias", "14 nov 2025". */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const diff = now.getTime() - date.getTime();
  if (Number.isNaN(diff)) return '';
  if (diff < MINUTE) return 'agora';
  if (diff < HOUR) return `há ${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY && date.getDate() === now.getDate()) return `há ${Math.floor(diff / HOUR)} h`;
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY);
  if (days <= 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return shortDate(iso);
}

/** "14 nov 2025". */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(iso))
    .replace(/\./g, '')
    .replace(/ de /g, ' ');
}

/** "jul. 2017" (membro desde). */
export function monthYear(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' })
    .format(new Date(iso))
    .replace(' de ', ' ');
}

/** "14:05". */
export function clockTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

/** "sáb, 14 nov · 14h". */
export function eventDate(iso: string): string {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(date)
    .replace('.', '');
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(date)
    .replace('.', '')
    .replace(' de ', ' ');
  const minutes = date.getMinutes();
  const hour = `${date.getHours()}h${minutes ? String(minutes).padStart(2, '0') : ''}`;
  return `${weekday}, ${day} · ${hour}`;
}

/** 1234 → "1,2 mil"; 6200000 → "6,2 mi". */
export function compactNumber(value: number): string {
  if (value < 1000) return String(value);
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
    .format(value)
    .replace(/\s+/g, ' ');
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
