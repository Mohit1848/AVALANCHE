import React from 'react';
import { Wind } from 'lucide-react';
import type { PredictionContext } from '../../types';
import { Section, MetricRow, StatusPill } from '../ui/Primitives';

interface WeatherPanelProps {
  context: PredictionContext;
}

const fmt = (v: number | null | undefined, unit: string, digits = 0) =>
  v !== null && v !== undefined ? `${v.toFixed(digits)} ${unit}` : '—';

export const WeatherPanel: React.FC<WeatherPanelProps> = ({ context }) => {
  const isStale = (context.freshness_state as string) === 'STALE';
  const gust = context.wind_speed_max_24h;

  return (
    <Section
      title="WEATHER"
      icon={<Wind className="w-3.5 h-3.5" />}
      meta={
        <StatusPill
          tone={isStale ? 'critical' : 'live'}
          glyph={isStale ? '⚠' : '●'}
          label={isStale ? 'STALE' : 'CURRENT'}
        />
      }
      testId="weather-panel"
    >
      <div className="min-w-0">
        <MetricRow
          label="Temperature"
          value={context.temperature !== null && context.temperature !== undefined ? `${context.temperature.toFixed(1)} °C` : '—'}
          testId="weather-temp"
        />
        <MetricRow label="Wind 24h mean" value={fmt(context.wind_speed_mean_24h, 'km/h')} testId="weather-wind" />
        <MetricRow
          label="Peak gust 24h"
          value={fmt(gust, 'km/h')}
          tone={gust !== null && gust !== undefined && gust >= 60 ? 'warn' : undefined}
          hint="Maximum recorded gust in the past 24 hours"
        />
        <MetricRow
          label="Pressure"
          value={fmt(context.pressure, 'hPa')}
          hint="Estimated barometrically from elevation — not a station measurement"
        />
        <MetricRow
          label="Humidity"
          value={fmt(context.humidity, '%')}
          hint="Not reported by SNOTEL stations — fixed model input"
        />
        <div className="t-meta wrap-safe pt-1.5 mt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          Wind direction is not measured; loading assessment is unavailable.
        </div>
      </div>
    </Section>
  );
};
