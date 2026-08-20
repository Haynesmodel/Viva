import { isLastPlaceGame } from '../../../js/core-helpers.js';
import type { PulseMatchupModel, PulsePhase } from './league-pulse-types';

export function pulseMatchupGroups(matchups: PulseMatchupModel[], phase: PulsePhase) {
  if (phase !== 'postseason') return [{ title: '', rows: matchups }];
  const lastPlace = (matchup: PulseMatchupModel) => isLastPlaceGame(matchup)
    || String(matchup.type || '').toLowerCase() === 'saunders'
    || String(matchup.round || '').toLowerCase().includes('saunders');
  return [
    { title: 'Championship bracket', rows: matchups.filter(matchup => !lastPlace(matchup)) },
    { title: 'Last-place bracket', rows: matchups.filter(lastPlace) },
  ].filter(group => group.rows.length);
}
