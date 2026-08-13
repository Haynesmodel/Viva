import { getTableRegistryEntry } from '../../tables/table-registry';
import { adaptCurrentProjectedRows, adaptCurrentStandingRows } from '../../tables/rows/current-standing-rows';
import type { VivaTableRuntime } from '../../tables/table-types';

export function registerCurrentSeasonTables(runtime: VivaTableRuntime): void {
  runtime.register('current-standings', getTableRegistryEntry('current-standings'), adaptCurrentStandingRows);
  runtime.register('current-projected', getTableRegistryEntry('current-projected'), adaptCurrentProjectedRows);
}
