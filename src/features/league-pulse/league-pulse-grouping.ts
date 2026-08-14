import { isLastPlaceGame } from '../../../js/core-helpers.js';
import type { PulseMatchupModel, PulsePhase } from './league-pulse-types';

export function pulseMatchupGroups(matchups: PulseMatchupModel[], phase: PulsePhase) {
  if (phase !== 'postseason') return [{ title: '', rows: matchups }];
  return [
    { title: 'Championship bracket', rows: matchups.filter(matchup => matchup.type !== 'Saunders' && !isLastPlaceGame(matchup)) },
    { title: 'Last Place bracket', rows: matchups.filter(isLastPlaceGame) },
    { title: 'Saunders bracket', rows: matchups.filter(matchup => matchup.type === 'Saunders') },
  ].filter(group => group.rows.length);
}
