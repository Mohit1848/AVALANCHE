import React from 'react';
import { Snowflake } from 'lucide-react';
import type { PredictionContext } from '../../types';
import { Section, MetricRow, StatusPill } from '../ui/Primitives';

interface SnowpackPanelProps {
  context: PredictionContext;
}

const fmt = (v: number | null | undefined, unit: string, digits = 0) =>
  v !== null && v !== undefined ? `${v.toFixed(digits)} ${unit}` : '—';

export const SnowpackPanel: React.FC<SnowpackPanelProps> = ({ context }) => {
  const isStale = (context.freshness_state as string) === 'STALE';
  const delta24 = context.temperature_delta_24h;

  return (
    <Section
      title="SNOWPACK"
      icon={<Snowflake className="w-3.5 h-3.5" />}
      meta={
        <StatusPill
          tone={isStale ? 'critical' : 'live'}
          glyph={isStale ? '⚠' : '●'}
          label={isStale ? 'STALE' : 'CURRENT'}
        />
      }
      testId="snowpack-panel"
    >
      <div className="min-w-0">
        <MetricRow label="Depth" value={fmt(context.snow_depth, 'cm')} testId="snowpack-depth" />
        <MetricRow label="SWE" value={fmt(context.snow_water_equivalent, 'mm')} hint="Snow water equivalent" testId="snowpack-swe" />
        <MetricRow label="Snow 6h" value={fmt(context.snowfall_6h, 'mm')} hint="Accumulation over the past 6 hours" />
        <MetricRow label="Snow 24h" value={fmt(context.snowfall_24h, 'mm')} hint="Accumulation over the past 24 hours" testId="snowpack-24h" />
        <MetricRow label="Snow 72h" value={fmt(context.snowfall_72h, 'mm')} hint="Accumulation over the past 72 hours" testId="snowpack-72h" />
        <MetricRow
          label="Temp Δ24h"
          value={delta24 !== null && delta24 !== undefined ? `${delta24 > 0 ? '+' : ''}${delta24.toFixed(1)} °C` : '—'}
          tone={delta24 !== null && delta24 !== undefined && delta24 >= 6 ? 'warn' : undefined}
          hint="Temperature change over the past 24 hours"
        />
        <div className="t-meta pt-1.5 mt-1 truncate-safe" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          Source: {context.telemetry_source || 'USDA NRCS AWDB'}
        </div>
      </div>
    </Section>
  );
};
