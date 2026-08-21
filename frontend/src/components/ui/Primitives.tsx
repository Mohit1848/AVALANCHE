/**
 * Shared UI primitives for the Mountain Risk Intelligence console.
 *
 * These exist so every panel expresses the same visual language instead of
 * each one inventing its own card. Presentation only — no domain logic, no
 * thresholds, no risk computation. All risk semantics stay in the backend.
 */
import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Status semantics                                                    */
/* ------------------------------------------------------------------ */

export type StatusTone = 'live' | 'warn' | 'critical' | 'neutral' | 'accent';

const TONE_VARS: Record<StatusTone, { fg: string; bg: string; border: string }> = {
  live: { fg: 'var(--status-live)', bg: 'var(--status-live-bg)', border: 'var(--status-live-border)' },
  warn: { fg: 'var(--status-warn)', bg: 'var(--status-warn-bg)', border: 'var(--status-warn-border)' },
  critical: { fg: 'var(--status-critical)', bg: 'var(--status-critical-bg)', border: 'var(--status-critical-border)' },
  neutral: { fg: 'var(--status-neutral)', bg: 'var(--status-neutral-bg)', border: 'var(--status-neutral-border)' },
  accent: { fg: 'var(--accent)', bg: 'var(--accent-bg)', border: 'var(--accent-border)' },
};

/**
 * Status pill. Renders a glyph AND text alongside the colour so status is
 * never communicated by colour alone (WCAG 1.4.1, spec §14).
 */
export const StatusPill: React.FC<{
  tone: StatusTone;
  label: string;
  glyph?: string;
  title?: string;
  pulse?: boolean;
  testId?: string;
}> = ({ tone, label, glyph = '●', title, pulse = false, testId }) => {
  const t = TONE_VARS[tone];
  return (
    <span
      data-testid={testId}
      title={title ?? label}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono font-bold shrink-0"
      style={{
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.border}`,
        fontSize: 'var(--fs-meta)',
      }}
    >
      <span aria-hidden="true" className={pulse ? 'pulse-dot' : undefined}>{glyph}</span>
      <span className="truncate-safe">{label}</span>
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Section shell                                                       */
/* ------------------------------------------------------------------ */

export const Section: React.FC<{
  title: string;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}> = ({ title, meta, icon, children, className = '', testId }) => (
  <section data-testid={testId} className={`panel ${className}`} style={{ padding: 'var(--card-padding)' }}>
    <header
      className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2.5"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="shrink-0" style={{ color: 'var(--accent)' }}>{icon}</span>}
        <h2 className="t-section truncate-safe">{title}</h2>
      </div>
      {meta && <div className="shrink-0 flex items-center gap-1.5">{meta}</div>}
    </header>
    {children}
  </section>
);

/**
 * Collapsible section — used for progressive disclosure so dense diagnostics
 * do not compete with the primary risk state (spec §6).
 */
export const Collapsible: React.FC<{
  title: string;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId?: string;
}> = ({ title, meta, icon, defaultOpen = false, children, testId }) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `sec-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section data-testid={testId} className="panel" style={{ padding: 'var(--card-padding)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="tap w-full flex flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span aria-hidden="true" style={{ color: 'var(--text-tertiary)' }}>
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          {icon && <span className="shrink-0" style={{ color: 'var(--accent)' }}>{icon}</span>}
          <span className="t-section truncate-safe">{title}</span>
        </span>
        {meta && <span className="shrink-0 flex items-center gap-1.5">{meta}</span>}
      </button>
      {open && (
        <div
          id={panelId}
          className="mt-2.5 pt-2.5 motion-fade"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          {children}
        </div>
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Metric row — compact horizontal label/value (spec §8)               */
/* ------------------------------------------------------------------ */

export const MetricRow: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: StatusTone;
  testId?: string;
}> = ({ label, value, hint, tone, testId }) => (
  <div
    data-testid={testId}
    className="flex items-baseline justify-between gap-3 py-1 min-w-0"
    title={hint}
  >
    <span className="t-meta truncate-safe" style={{ color: 'var(--text-secondary)' }}>
      {label}
    </span>
    <span
      className="font-mono font-bold shrink-0 text-right"
      style={{
        fontSize: 'var(--fs-body)',
        color: tone ? TONE_VARS[tone].fg : 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </span>
  </div>
);

/* ------------------------------------------------------------------ */
/* Data table — horizontally scrollable within its own container       */
/* ------------------------------------------------------------------ */

export const DataTable: React.FC<{
  columns: string[];
  children: React.ReactNode;
  caption?: string;
  testId?: string;
}> = ({ columns, children, caption, testId }) => (
  <div className="scroll-x" data-testid={testId}>
    <table className="w-full border-collapse" style={{ fontSize: 'var(--fs-meta)' }}>
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {columns.map((c, i) => (
            <th
              key={c}
              scope="col"
              className="t-section py-1.5 px-2 whitespace-nowrap"
              style={{ textAlign: i === 0 ? 'left' : 'right' }}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export const DataRow: React.FC<{
  cells: React.ReactNode[];
  testId?: string;
}> = ({ cells, testId }) => (
  <tr
    data-testid={testId}
    style={{ borderBottom: '1px solid var(--border-subtle)', height: 'var(--table-row-height)' }}
  >
    {cells.map((c, i) => (
      <td
        key={i}
        className="py-1.5 px-2 font-mono whitespace-nowrap"
        style={{
          textAlign: i === 0 ? 'left' : 'right',
          color: i === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {c}
      </td>
    ))}
  </tr>
);

/* ------------------------------------------------------------------ */
/* Risk scale — horizontal 0-100 bar with model & policy markers       */
/* ------------------------------------------------------------------ */

export const riskColor = (level: string): string => {
  switch ((level || '').toUpperCase()) {
    case 'LOW': return 'var(--risk-low)';
    case 'MEDIUM': return 'var(--risk-medium)';
    case 'HIGH':
    case 'EXTREME': return 'var(--risk-high)';
    default: return 'var(--risk-unknown)';
  }
};

export const riskTone = (level: string): StatusTone => {
  switch ((level || '').toUpperCase()) {
    case 'LOW': return 'live';
    case 'MEDIUM': return 'warn';
    case 'HIGH':
    case 'EXTREME': return 'critical';
    default: return 'neutral';
  }
};

/**
 * Horizontal risk scale. Shows where model and policy each land on 0-100, so
 * the gap between them is visible rather than implied.
 */
export const RiskScale: React.FC<{
  modelScore: number | null;
  policyScore: number | null;
  policyLevel: string;
}> = ({ modelScore, policyScore, policyLevel }) => {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return (
    <div className="min-w-0">
      <div
        className="relative w-full rounded-full overflow-hidden"
        style={{ height: 6, background: 'var(--surface-inset)', border: '1px solid var(--border-subtle)' }}
        role="img"
        aria-label={`Policy risk ${policyScore ?? 'unavailable'} of 100, level ${policyLevel}`}
      >
        {policyScore !== null && (
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${clamp(policyScore)}%`,
              background: riskColor(policyLevel),
              transition: 'width 320ms cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        )}
        {modelScore !== null && (
          <div
            className="absolute inset-y-0"
            style={{
              left: `${clamp(modelScore)}%`,
              width: 2,
              background: 'var(--text-primary)',
              opacity: 0.85,
            }}
            title={`Model ${modelScore}/100`}
          />
        )}
      </div>
      <div className="flex justify-between t-meta mt-1">
        <span>0</span>
        <span style={{ color: 'var(--text-tertiary)' }}>
          {modelScore !== null ? `│ model ${modelScore}` : ''}
        </span>
        <span>100</span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Domain badge (spec §11)                                             */
/* ------------------------------------------------------------------ */

export const DomainBadge: React.FC<{
  domain: 'COLORADO' | 'HIMALAYA';
  testId?: string;
}> = ({ domain, testId }) => {
  const isCO = domain === 'COLORADO';
  return (
    <div data-testid={testId} className="flex items-center gap-2 min-w-0">
      <span className="t-meta shrink-0" style={{ color: 'var(--text-tertiary)' }}>DOMAIN</span>
      <StatusPill
        tone={isCO ? 'accent' : 'warn'}
        glyph={isCO ? '▲' : '▲'}
        label={isCO ? 'COLORADO • MODEL ENABLED' : 'HIMALAYAN • RESEARCH ONLY'}
        title={
          isCO
            ? 'Colorado domain: statistical model enabled, subject to telemetry freshness gates'
            : 'Indian Himalayas: inference disabled — insufficient operational validation'
        }
      />
    </div>
  );
};
