import { getTableRegistryEntry } from '../../tables/table-registry';
import { adaptDraftSpotRows } from '../../tables/rows/draft-spot-rows';
import type { VivaTableRuntime } from '../../tables/table-types';

export function registerDraftSpotTables(runtime: VivaTableRuntime): void {
  runtime.register('draft-rows', getTableRegistryEntry('draft-rows'), adaptDraftSpotRows);
}
