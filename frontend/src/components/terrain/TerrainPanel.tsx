import React from 'react';
import { Mountain } from 'lucide-react';
import type { PredictionContext } from '../../types';
import { Section, MetricRow } from '../ui/Primitives';

interface TerrainPanelProps {
  context: PredictionContext;
}

const getAspectDirection = (deg: number | null) => {
  if (deg === null || isNaN(deg)) return 'N/A';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(deg / 45) % 8];
};

export const TerrainPanel: React.FC<TerrainPanelProps> = ({ context }) => {
  const slope = context.slope;
  // Presentation-only heuristic band. Not a causal or predictive claim.
  const isProneSlope = slope !== null && slope >= 30.0 && slope <= 45.0;
  const aspectAngle = context.aspect;

  return (
    <Section
      title="TERRAIN"
      icon={<Mountain className="w-3.5 h-3.5" />}
      meta={<span className="t-meta truncate-safe">{context.terrain_source || 'Copernicus GLO-30 (30m)'}</span>}
      testId="terrain-panel"
    >
      <div className="min-w-0">
        <MetricRow
          label="Slope"
          value={slope !== null ? `${slope.toFixed(1)}°` : 'N/A'}
          tone={isProneSlope ? 'warn' : undefined}
          hint="Starting-zone slope angle derived from the DEM"
          testId="terrain-slope"
        />

        {/* Slope scale with the heuristic band marked */}
        <div className="py-1.5 min-w-0">
          <div
            className="relative w-full rounded-full overflow-hidden"
            style={{ height: 5, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}
            role="img"
            aria-label={`Slope ${slope ?? 'unknown'} degrees on a 0 to 60 degree scale`}
          >
            <div
              className="absolute inset-y-0"
              style={{ left: '50%', width: '25%', background: 'var(--status-warn)', opacity: 0.22 }}
            />
            {slope !== null && (
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${Math.min(100, (slope / 60) * 100)}%`,
                  background: isProneSlope ? 'var(--status-warn)' : 'var(--accent)',
                  transition: 'width 300ms cubic-bezier(0.4,0,0.2,1)',
                }}
              />
            )}
          </div>
          <div className="flex justify-between t-meta mt-1 gap-2">
            <span className="shrink-0">0°</span>
            <span
              className="truncate-safe font-bold"
              style={{ color: 'var(--status-warn)' }}
              title="Heuristic band only — not a causal or universally predictive rule"
            >
              30°–45° Prone Range (Heuristic)
            </span>
            <span className="shrink-0">60°+</span>
          </div>
        </div>

        {isProneSlope && (
          <div className="t-meta wrap-safe py-1" style={{ color: 'var(--status-warn)' }}>
            Terrain heuristic: slope falls within the commonly cited avalanche-prone slope-angle range.
          </div>
        )}

        <MetricRow
          label="Aspect"
          value={aspectAngle !== null ? `${getAspectDirection(aspectAngle)} ${aspectAngle.toFixed(0)}°` : 'N/A'}
          hint="Slope aspect in degrees, 0 = North"
          testId="terrain-aspect"
        />
        <MetricRow
          label="Elevation"
          value={context.elevation !== null ? `${context.elevation.toLocaleString()} m` : 'N/A'}
          hint="Starting-zone elevation above sea level"
          testId="terrain-elevation"
        />
        <MetricRow
          label="Zone"
          value={
            context.elevation !== null && context.elevation > 3500
              ? 'Alpine (above treeline)'
              : 'Near / below treeline'
          }
        />

        <div className="t-meta wrap-safe pt-1.5 mt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          Wind-loading assessment requires localized wind-direction telemetry
        </div>
      </div>
    </Section>
  );
};
