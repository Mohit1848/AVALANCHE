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
    case 'GOOD':
      return 'bg-emerald-950/60 border-emerald-800 text-emerald-300';
    case 'DEGRADED':
      return 'bg-amber-950/60 border-amber-800 text-amber-300';
    case 'STALE':
      return 'bg-red-950/60 border-red-800 text-red-300 animate-pulse';
    case 'INSUFFICIENT':
    case 'INSUFFICIENT_DATA':
    default:
      return 'bg-slate-800 border-slate-700 text-slate-300';
  }
}
