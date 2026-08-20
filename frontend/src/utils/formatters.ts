/**
 * Telemetry and Freshness Formatters & Helpers
 */

export function formatTelemetryAge(ageMinutes: number | null | undefined): string {
  if (ageMinutes === null || ageMinutes === undefined || isNaN(ageMinutes)) {
    return 'UNAVAILABLE';
  }
  if (ageMinutes < 0) {
    return '0m';
  }
  if (ageMinutes < 60) {
    return `${ageMinutes}m`;
  }
  const hours = Math.floor(ageMinutes / 60);
  const mins = ageMinutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export function formatTelemetryAgeCompact(ageMinutes: number | null | undefined): string {
  if (ageMinutes === null || ageMinutes === undefined || isNaN(ageMinutes)) {
    return 'N/A';
  }
  if (ageMinutes < 0) {
    return '0m';
  }
  if (ageMinutes < 60) {
    return `${ageMinutes}m`;
  }
  const hours = Math.floor(ageMinutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function getTelemetryBadgeColor(st: string): string {
  switch (st) {
    case 'LIVE':
    case 'GOOD':
      return 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-950';
    case 'DEGRADED':
    case 'RECENT':
      return 'bg-amber-950/80 border-amber-500 text-amber-300';
    case 'STALE':
      return 'bg-red-950/90 border-red-500 text-red-300';
    case 'HISTORICAL':
      return 'bg-slate-900 border-slate-700 text-slate-400';
    case 'OFFLINE':
      return 'bg-red-950/60 border-red-800 text-red-400';
    case 'INSUFFICIENT':
    case 'INSUFFICIENT_DATA':
    default:
      return 'bg-slate-800 border-slate-700 text-slate-300';
  }
}
