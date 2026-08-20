import { isLastPlaceGame } from '../../../js/core-helpers.js';
import type { PulseMatchupModel, PulsePhase } from './league-pulse-types';

export function pulseMatchupGroups(matchups: PulseMatchupModel[], phase: PulsePhase) {
  if (phase !== 'postseason') return [{ title: '', rows: matchups }];
  return [
    { title: 'Championship bracket', rows: matchups.filter(matchup => matchup.type !== 'Saunders' && !isLastPlaceGame(matchup)) },
    { title: 'Last-place bracket', rows: matchups.filter(matchup => isLastPlaceGame(matchup) || String(matchup.type || '').toLowerCase() === 'saunders' || String(matchup.round || '').toLowerCase().includes('saunders')) },
  ].filter(group => group.rows.length);
}
