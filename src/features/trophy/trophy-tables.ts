import { getTableRegistryEntry } from '../../tables/table-registry';
import { adaptTrophySeasonRows } from '../../tables/rows/trophy-season-rows';
import type { VivaTableRuntime } from '../../tables/table-types';

export function registerTrophyTables(runtime: VivaTableRuntime): void {
  runtime.register('trophy-seasons', getTableRegistryEntry('trophy-seasons'), adaptTrophySeasonRows);
}
