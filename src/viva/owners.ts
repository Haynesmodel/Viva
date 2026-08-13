import type { OwnerTheme } from '../theme/theme-types';

export interface VivaOwnerConfig {
  canonical: string;
  aliases: readonly string[];
  displayName: string;
  imageKey: string | null;
  imageAlt: string;
  theme: OwnerTheme;
  titleNotes: Readonly<Record<string, string>>;
  active: boolean;
  shotgunDisplayName: string;
  historicalExclusion: boolean;
}

const image = (canonical: string): string => `assets/${canonical}.jpeg`;
const theme = (
  owner: string,
  primary: string,
  secondary: string,
  softLight: string,
  softDark: string,
): OwnerTheme => ({ owner, primary, secondary, softLight, softDark, textOnPrimary: '#ffffff' });

export const VIVA_OWNERS: readonly VivaOwnerConfig[] = [
  { canonical: 'Dulberger', aliases: ['Josh'], displayName: 'Dulberger', imageKey: image('Dulberger'), imageAlt: 'Dulberger', theme: theme('Dulberger', '#1d4ed8', '#60a5fa', '#eff6ff', 'rgba(96,165,250,.16)'), titleNotes: {}, active: true, shotgunDisplayName: 'Josh', historicalExclusion: false },
  { canonical: 'Erin', aliases: [], displayName: 'Erin', imageKey: image('Erin'), imageAlt: 'Erin', theme: theme('Erin', '#be123c', '#fb7185', '#fff1f2', 'rgba(251,113,133,.16)'), titleNotes: {}, active: true, shotgunDisplayName: 'Erin', historicalExclusion: false },
  { canonical: 'Joe', aliases: [], displayName: 'Joe', imageKey: image('Joe'), imageAlt: 'Joe', theme: theme('Joe', '#2563eb', '#60a5fa', '#eff6ff', 'rgba(96,165,250,.16)'), titleNotes: { 'saunders:2015': 'Saunders Bowl matchups incorrect' }, active: true, shotgunDisplayName: 'Joe', historicalExclusion: false },
  { canonical: 'Kylie', aliases: [], displayName: 'Kylie', imageKey: image('Kylie'), imageAlt: 'Kylie', theme: theme('Kylie', '#7c3aed', '#a78bfa', '#f5f3ff', 'rgba(167,139,250,.18)'), titleNotes: {}, active: true, shotgunDisplayName: 'Kylie', historicalExclusion: false },
  { canonical: 'Leah', aliases: [], displayName: 'Leah', imageKey: image('Leah'), imageAlt: 'Leah', theme: theme('Leah', '#047857', '#34d399', '#ecfdf5', 'rgba(52,211,153,.16)'), titleNotes: {}, active: true, shotgunDisplayName: 'Leah', historicalExclusion: false },
  { canonical: 'Malcolm', aliases: [], displayName: 'Malcolm', imageKey: image('Malcolm'), imageAlt: 'Malcolm', theme: theme('Malcolm', '#b45309', '#f59e0b', '#fffbeb', 'rgba(245,158,11,.18)'), titleNotes: {}, active: true, shotgunDisplayName: 'Malcolm', historicalExclusion: false },
  { canonical: 'Marian', aliases: [], displayName: 'Marian', imageKey: image('Marian'), imageAlt: 'Marian', theme: theme('Marian', '#0f766e', '#2dd4bf', '#f0fdfa', 'rgba(45,212,191,.16)'), titleNotes: {}, active: true, shotgunDisplayName: 'Marian', historicalExclusion: false },
  { canonical: 'Mino', aliases: [], displayName: 'Mino', imageKey: image('Mino'), imageAlt: 'Mino', theme: theme('Mino', '#0891b2', '#67e8f9', '#ecfeff', 'rgba(103,232,249,.14)'), titleNotes: {}, active: true, shotgunDisplayName: 'Mino', historicalExclusion: false },
  { canonical: 'Rico', aliases: [], displayName: 'Rico', imageKey: image('Rico'), imageAlt: 'Rico', theme: theme('Rico', '#c2410c', '#fb923c', '#fff7ed', 'rgba(251,146,60,.16)'), titleNotes: {}, active: true, shotgunDisplayName: 'Rico', historicalExclusion: false },
  { canonical: 'Seth', aliases: [], displayName: 'Seth', imageKey: image('Seth'), imageAlt: 'Seth', theme: theme('Seth', '#4f46e5', '#818cf8', '#eef2ff', 'rgba(129,140,248,.17)'), titleNotes: {}, active: true, shotgunDisplayName: 'Seth', historicalExclusion: false },
  { canonical: 'Taylor', aliases: [], displayName: 'Taylor', imageKey: image('Taylor'), imageAlt: 'Taylor', theme: theme('Taylor', '#dc2626', '#f87171', '#fef2f2', 'rgba(248,113,113,.16)'), titleNotes: {}, active: true, shotgunDisplayName: 'Taylor', historicalExclusion: false },
  { canonical: 'Wei', aliases: [], displayName: 'Wei', imageKey: image('Wei'), imageAlt: 'Wei', theme: theme('Wei', '#c026d3', '#f0abfc', '#fdf4ff', 'rgba(240,171,252,.16)'), titleNotes: {}, active: true, shotgunDisplayName: 'Wei', historicalExclusion: false },
  { canonical: 'Chuck', aliases: [], displayName: 'Chuck', imageKey: null, imageAlt: 'Chuck', theme: theme('Chuck', '#475569', '#94a3b8', '#f8fafc', 'rgba(148,163,184,.16)'), titleNotes: {}, active: false, shotgunDisplayName: 'Chuck', historicalExclusion: true },
  { canonical: 'Julia', aliases: [], displayName: 'Julia', imageKey: null, imageAlt: 'Julia', theme: theme('Julia', '#334155', '#94a3b8', '#f8fafc', 'rgba(148,163,184,.16)'), titleNotes: {}, active: false, shotgunDisplayName: 'Julia', historicalExclusion: true },
];

const OWNER_BY_NAME = new Map<string, VivaOwnerConfig>();
for (const owner of VIVA_OWNERS) {
  OWNER_BY_NAME.set(owner.canonical.toLowerCase(), owner);
  owner.aliases.forEach(alias => OWNER_BY_NAME.set(alias.toLowerCase(), owner));
}

export function resolveVivaOwner(value: unknown): VivaOwnerConfig | null {
  const key = String(value || '').trim().toLowerCase();
  return key ? OWNER_BY_NAME.get(key) || null : null;
}

export function requireVivaOwner(value: unknown, source: string, season?: number | string): VivaOwnerConfig {
  const resolved = resolveVivaOwner(value);
  if (!resolved) throw new Error(`Unknown Viva owner "${String(value || '').trim()}" at ${source}${season === undefined ? '' : ` season ${season}`}`);
  return resolved;
}

export function canonicalVivaOwner(value: unknown, source?: string, season?: number | string): string {
  const owner = source ? requireVivaOwner(value, source, season) : resolveVivaOwner(value);
  return owner ? owner.canonical : String(value || '').trim();
}

export function vivaOwnerNames(options: { includeInactive?: boolean } = {}): string[] {
  return VIVA_OWNERS.filter(owner => options.includeInactive || owner.active).map(owner => owner.canonical);
}

export function vivaOwnerTheme(owner: unknown): OwnerTheme | null {
  return resolveVivaOwner(owner)?.theme || null;
}

export function vivaOwnerImage(owner: unknown): { src: string; alt: string } | null {
  const config = resolveVivaOwner(owner);
  return config?.imageKey ? { src: config.imageKey, alt: config.imageAlt } : null;
}

export function vivaShotgunDisplayName(owner: unknown): string {
  return resolveVivaOwner(owner)?.shotgunDisplayName || String(owner || '');
}

export function vivaTitleNote(owner: unknown, kind: 'champion' | 'saunders', season: number | string): string | null {
  return resolveVivaOwner(owner)?.titleNotes[`${kind === 'champion' ? 'champ' : 'saunders'}:${season}`] || null;
}
