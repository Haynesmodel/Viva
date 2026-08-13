import { VIVA_OWNERS } from '../viva/owners';
import type { OwnerTheme } from './theme-types';

export const OWNER_THEMES: OwnerTheme[] = VIVA_OWNERS.map(owner => owner.theme);

const OWNER_THEME_MAP = new Map(OWNER_THEMES.map(theme => [theme.owner.toLowerCase(), theme]));

export function getOwnerTheme(owner: string | null | undefined): OwnerTheme | null {
  if (!owner) return null;
  return OWNER_THEME_MAP.get(String(owner).trim().toLowerCase()) || null;
}

export function ownerThemeNames(): string[] {
  return OWNER_THEMES.map(theme => theme.owner);
}
