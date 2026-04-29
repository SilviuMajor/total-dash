export interface ResponseThresholds {
  green_seconds?: number;
  amber_seconds?: number;
}

export function formatWaitTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function getResponseTimeColor(
  seconds: number,
  thresholds?: ResponseThresholds,
): { color: string; label: 'green' | 'amber' | 'red' } {
  const greenMax = thresholds?.green_seconds ?? 60;
  const amberMax = thresholds?.amber_seconds ?? 300;
  if (seconds <= greenMax) return { color: '#22c55e', label: 'green' };
  if (seconds <= amberMax) return { color: '#f59e0b', label: 'amber' };
  return { color: '#ef4444', label: 'red' };
}
