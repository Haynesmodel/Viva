import type { VivaTableRow } from './table-types';

export interface NumberRangeValue {
  min?: number | null;
  max?: number | null;
}

export function textFilterValue(value: unknown, query: unknown): boolean {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  if (!needle) return true;
  return String(value ?? '').toLocaleLowerCase().includes(needle);
}

export function enumFilterValue(value: unknown, selected: unknown): boolean {
  const values = Array.isArray(selected) ? selected : [selected];
  const normalized = values.map(item => String(item ?? '')).filter(Boolean);
  return normalized.length === 0 || normalized.includes(String(value ?? ''));
}

export function numberRangeFilterValue(value: unknown, range: NumberRangeValue | null | undefined): boolean {
  if (!range || typeof range !== 'object') return true;
  const number = Number(value);
  if (!Number.isFinite(number)) return false;
  const min = Number(range.min);
  const max = Number(range.max);
  if (range.min !== null && range.min !== undefined && Number.isFinite(min) && number < min) return false;
  if (range.max !== null && range.max !== undefined && Number.isFinite(max) && number > max) return false;
  return true;
}

export function parseRecord(value: unknown): number {
  const match = String(value ?? '').match(/^(\d+)-(\d+)(?:-(\d+))?/);
  if (!match) return Number.NaN;
  const wins = Number(match[1]);
  const losses = Number(match[2]);
  const ties = Number(match[3] || 0);
  const games = wins + losses + ties;
  return games ? (wins + ties * 0.5) / games : 0;
}

export function parseScore(value: unknown): number {
  const match = String(value ?? '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

export function isPostseason(row: VivaTableRow): boolean {
  return String(row.type ?? '').toLocaleLowerCase() !== 'regular';
}

export function isSaunders(row: VivaTableRow): boolean {
  return `${row.type ?? ''} ${row.round ?? ''}`.toLocaleLowerCase().includes('saunders')
    || `${row.type ?? ''} ${row.round ?? ''}`.toLocaleLowerCase().includes('last place');
}

export function displayGameType(value: unknown): string {
  return String(value ?? '').replace(/^saunders$/i, 'Last place');
}

export function displayRound(value: unknown): string {
  return String(value ?? '').replace(/^saunders\b/i, 'Last place');
}

export function isCloseGame(row: VivaTableRow, threshold = 5): boolean {
  return Math.abs(Number(row.margin)) <= threshold;
}

export function isBlowout(row: VivaTableRow, threshold = 29): boolean {
  return Math.abs(Number(row.margin)) >= threshold;
}

export function isEmptyRange(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  const range = value as NumberRangeValue;
  return (range.min === null || range.min === undefined)
    && (range.max === null || range.max === undefined);
}
