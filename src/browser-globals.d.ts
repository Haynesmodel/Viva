declare const window: any;
declare const document: any;
declare function requestAnimationFrame(callback: (...args: any[]) => void): number;
declare class PopStateEvent {
  constructor(type: string, eventInitDict?: any);
}

interface Window {
  vivaTables?: import('./tables/table-types').VivaTableRuntime;
  vivaAccessibility?: any;
  vivaDataDiagnostics?: import('./data/load-league-assets').DataDiagnostics;
  vivaFeatureDiagnostics?: import('./app/app-types').AppDiagnostics;
  __vivaDataVersion?: string;
  __vivaRenderMetrics?: { filterRuns: number };
}
