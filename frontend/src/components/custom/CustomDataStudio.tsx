import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Download,
  Copy,
  Sparkles,
  ArrowRight,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet,
  Trash2,
  FileDown,
} from 'lucide-react';
import {
  api,
  SUPPORTED_SCHEMA_FIELDS,
  SAMPLE_TEMPLATES,
  validateCustomPayload,
  exportEvaluatedToCSV,
  downloadSampleCsvTemplate,
} from '../../services/api';
import type {
  CustomDataFormat,
  CustomDataValidationResult,
  EvaluatedPointRecord,
  BatchSummaryStats,
  SelectedLocationState,
  RiskLevel,
} from '../../types';

interface CustomDataStudioProps {
  activeCsvRecords?: EvaluatedPointRecord[];
  activeCsvFilename?: string;
  onSetActiveCsvDataset: (records: EvaluatedPointRecord[], filename: string) => void;
  onApplyLocationToConsole: (location: SelectedLocationState) => void;
  onNavigateToConsole: () => void;
}

export const CustomDataStudio: React.FC<CustomDataStudioProps> = ({
  activeCsvRecords = [],
  activeCsvFilename = 'colorado_mountain_passes.csv',
  onSetActiveCsvDataset,
  onApplyLocationToConsole,
  onNavigateToConsole,
}) => {
  // Input State (CSV Default)
  const [format, setFormat] = useState<CustomDataFormat>('csv');
  const [inputText, setInputText] = useState<string>(SAMPLE_TEMPLATES.global_mountains_csv);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(activeCsvFilename);
  const [validation, setValidation] = useState<CustomDataValidationResult>(() =>
    validateCustomPayload(SAMPLE_TEMPLATES.global_mountains_csv, 'csv')
  );

  // Inference & Results State
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluatedRecords, setEvaluatedRecords] = useState<EvaluatedPointRecord[]>(() => activeCsvRecords);
  const [summaryStats, setSummaryStats] = useState<BatchSummaryStats | null>(() => {
    if (activeCsvRecords.length > 0) {
      return computeSummaryStats(activeCsvRecords);
    }
    return null;
  });

  // UI Table & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showSchemaModal, setShowSchemaModal] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [appliedNotification, setAppliedNotification] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-validate whenever text or format changes
  useEffect(() => {
    const res = validateCustomPayload(inputText, format);
    setValidation(res);
  }, [inputText, format]);

  // Sync if parent passes initial evaluated records
  useEffect(() => {
    if (activeCsvRecords.length > 0 && evaluatedRecords.length === 0) {
      setEvaluatedRecords(activeCsvRecords);
      setSummaryStats(computeSummaryStats(activeCsvRecords));
    }
  }, [activeCsvRecords]);

  // Helper: compute summary stats from evaluated records
  function computeSummaryStats(records: EvaluatedPointRecord[]): BatchSummaryStats {
    let low = 0, med = 0, high = 0, insuff = 0, rulesCount = 0;
    let scoreSum = 0;
    let highestPoint: { name: string; score: number; level: RiskLevel } | null = null;

    records.forEach((r) => {
      if (r.prediction) {
        const level = r.prediction.final_risk_level;
        const score = r.prediction.final_risk_score ?? 0;
        scoreSum += score;

        if (level === 'LOW') low++;
        else if (level === 'MEDIUM') med++;
        else if (level === 'HIGH') high++;
        else insuff++;

        if (r.prediction.risk_escalated) rulesCount++;

        if (!highestPoint || score > highestPoint.score) {
          highestPoint = {
            name: r.location_id,
            score,
            level,
          };
        }
      }
    });

    return {
      total: records.length,
      lowCount: low,
      mediumCount: med,
      highCount: high,
      insufficientCount: insuff,
      avgRiskScore: records.length > 0 ? scoreSum / records.length : 0,
      highestRiskLocation: highestPoint,
      rulesTriggeredCount: rulesCount,
    };
  }

  // Handle 1-Click CSV Template Loading
  const handleLoadCsvTemplate = (templateKey: keyof typeof SAMPLE_TEMPLATES, name: string) => {
    const text = SAMPLE_TEMPLATES[templateKey];
    setFormat('csv');
    setInputText(text);
    setUploadedFileName(name);
    setEvaluatedRecords([]);
    setSummaryStats(null);
  };

  // Handle CSV File Upload / Drop
  const handleFileUpload = (file: File) => {
    setFormat('csv');
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setInputText(content);
        setEvaluatedRecords([]);
        setSummaryStats(null);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Copy CSV input
  const handleCopyInput = () => {
    navigator.clipboard.writeText(inputText);
    setCopiedNotification('CSV copied to clipboard!');
    setTimeout(() => setCopiedNotification(null), 2500);
  };

  // Run Inference on CSV Rows
  const handleRunInference = async () => {
    if (!validation.isValid || !validation.parsedData) return;

    setIsEvaluating(true);
    setEvaluatedRecords([]);
    setSummaryStats(null);

    try {
      const points = Array.isArray(validation.parsedData) ? validation.parsedData : [validation.parsedData];

      const batchPayload = points.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        elevation: p.elevation,
        slope: p.slope,
        aspect: p.aspect,
        temperature: p.temperature,
        humidity: p.humidity,
        pressure: p.pressure,
        snow_depth: p.snow_depth,
        snow_water_equivalent: p.snow_water_equivalent,
        snowfall_6h: p.snowfall_6h,
        snowfall_24h: p.snowfall_24h,
        snowfall_72h: p.snowfall_72h,
        temperature_delta_24h: p.temperature_delta_24h,
        temperature_delta_72h: p.temperature_delta_72h,
        wind_speed_mean_24h: p.wind_speed_mean_24h,
        wind_speed_max_24h: p.wind_speed_max_24h,
        location_id: p.location_id || `Point ${p.latitude}, ${p.longitude}`,
      }));

      const batchResp = await api.predictBatch(batchPayload);

      const records: EvaluatedPointRecord[] = points.map((pt, idx) => {
        const resItem = batchResp.results.find((r) => r.index === idx);
        return {
          id: `CSV_REC_${idx + 1}_${(pt.location_id || 'PT').replace(/\s+/g, '_')}`,
          index: idx + 1,
          location_id: pt.location_id || `CSV Row #${idx + 1}`,
          latitude: pt.latitude,
          longitude: pt.longitude,
          elevation: pt.elevation ?? 3400,
          slope: pt.slope ?? 36,
          aspect: pt.aspect ?? 45,
          temperature: pt.temperature ?? -5,
          humidity: pt.humidity,
          pressure: pt.pressure,
          snow_depth: pt.snow_depth ?? 120,
          snow_water_equivalent: pt.snow_water_equivalent ?? 200,
          snowfall_6h: pt.snowfall_6h ?? 0,
          snowfall_24h: pt.snowfall_24h ?? 15,
          snowfall_72h: pt.snowfall_72h ?? 35,
          wind_speed_mean_24h: pt.wind_speed_mean_24h ?? 20,
          wind_speed_max_24h: pt.wind_speed_max_24h ?? 40,
          prediction: resItem?.prediction || undefined,
          status: resItem?.error ? 'ERROR' : 'SUCCESS',
          errorMessage: resItem?.error || undefined,
        };
      });

      setEvaluatedRecords(records);
      const stats = computeSummaryStats(records);
      setSummaryStats(stats);

      // Auto-set as active CSV dataset for the application
      const filename = uploadedFileName || 'custom_avalanche_data.csv';
      onSetActiveCsvDataset(records, filename);
    } catch (err) {
      console.error('CSV inference evaluation error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Apply Record to Console / Live Location State
  const handleApplyToConsole = (record: EvaluatedPointRecord) => {
    const locationState: SelectedLocationState = {
      type: 'COORDINATE',
      name: record.location_id,
      latitude: record.latitude,
      longitude: record.longitude,
      elevation: record.elevation,
      slope: record.slope,
      aspect: record.aspect,
      temperature: record.temperature,
      snow_depth: record.snow_depth ?? 120,
      snow_water_equivalent: record.snow_water_equivalent ?? 200,
      snowfall_6h: record.snowfall_6h ?? 0,
      snowfall_24h: record.snowfall_24h ?? 15,
      snowfall_72h: record.snowfall_72h ?? 35,
      temperature_delta_24h: record.temperature_delta_24h ?? 0,
      wind_speed_mean_24h: record.wind_speed_mean_24h ?? 20,
      wind_speed_max_24h: record.wind_speed_max_24h ?? 40,
      telemetry_age_minutes: 0,
    };

    onApplyLocationToConsole(locationState);
    setAppliedNotification(`Loaded "${record.location_id}" from CSV into Risk Console & Map!`);
    setTimeout(() => setAppliedNotification(null), 3000);
  };

  // Export Results
  const handleExportCSV = () => {
    const csvContent = exportEvaluatedToCSV(evaluatedRecords);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `avalanche_evaluated_${(uploadedFileName || 'custom_data').replace(/\.csv$/, '')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered records for table view
  const filteredRecords = evaluatedRecords.filter((r) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      r.location_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.latitude.toString().includes(searchQuery) ||
      r.longitude.toString().includes(searchQuery);

    const matchesRisk =
      riskFilter === 'ALL' ||
      r.prediction?.final_risk_level === riskFilter;

    return matchesSearch && matchesRisk;
  });

  const getRiskBadgeClasses = (level?: RiskLevel) => {
    switch (level) {
      case 'HIGH':
        return 'bg-red-950 text-red-300 border-red-800 shadow-sm shadow-red-950';
      case 'MEDIUM':
        return 'bg-amber-950 text-amber-300 border-amber-800 shadow-sm shadow-amber-950';
      case 'LOW':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800 shadow-sm shadow-emerald-950';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto w-full min-w-0 font-sans">
      {/* 1. Header Banner & Quick Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 rounded-xl text-white shadow-md shadow-emerald-500/20 shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2 truncate">
                <span>CSV DATA STUDIO & BATCH INGESTION</span>
                <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded shrink-0">
                  CSV-FIRST ARCHITECTURE
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 truncate">
              Upload, insert, validate, and batch evaluate your custom CSV mountain datasets to drive the entire application.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={downloadSampleCsvTemplate}
            className="flex items-center gap-1.5 bg-slate-950 border border-emerald-800 hover:border-emerald-600 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm"
            title="Download ready-to-fill CSV template file"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download CSV Template</span>
          </button>

          <button
            onClick={() => setShowSchemaModal(true)}
            className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 hover:border-slate-500 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>CSV Columns Guide</span>
          </button>

          <button
            onClick={onNavigateToConsole}
            className="flex items-center gap-1.5 bg-cyan-950 border border-cyan-800 hover:border-cyan-600 text-cyan-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          >
            <span>Go to Live Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {copiedNotification && (
        <div className="bg-emerald-950 border border-emerald-800 text-emerald-200 text-xs px-4 py-2 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{copiedNotification}</span>
        </div>
      )}
      {appliedNotification && (
        <div className="bg-cyan-950 border border-cyan-800 text-cyan-200 text-xs px-4 py-2 rounded-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{appliedNotification}</span>
          </div>
          <button
            onClick={onNavigateToConsole}
            className="text-[11px] underline font-semibold text-cyan-300 hover:text-cyan-100 cursor-pointer"
          >
            View Live Map & Assessment &rarr;
          </button>
        </div>
      )}

      {/* 2. Main Two-Column Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-w-0">
        {/* LEFT COLUMN: CSV Input & Upload Studio (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-3.5 min-w-0 w-full">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-xs text-white uppercase tracking-wider">
                  CSV Input / Upload
                </span>
              </div>

              {/* Upload CSV File Button */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  accept=".csv,.txt"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-emerald-700 text-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Upload .CSV File</span>
                </button>
              </div>
            </div>

            {/* Quick 1-Click CSV Preset Templates Bar */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400 uppercase font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Load Preset CSV Dataset:</span>
                </span>
                {uploadedFileName && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1">
                    <span>File: {uploadedFileName}</span>
                    <button
                      onClick={() => setUploadedFileName(null)}
                      className="hover:text-red-400 ml-1"
                      title="Clear file tag"
                    >
                      &times;
                    </button>
                  </span>
                )}
              </div>

                <button
                  onClick={() => handleLoadCsvTemplate('global_mountains_csv', 'global_avalanche_mountains_master.csv')}
                  className="px-2.5 py-1 rounded bg-gradient-to-r from-emerald-950 to-teal-950 border border-emerald-600 text-emerald-200 hover:border-emerald-400 font-bold transition-all text-[11px] cursor-pointer shadow-sm"
                >
                  🌍 Worldwide 60+ Avalanche Mountains (Master CSV)
                </button>
                <button
                  onClick={() => handleLoadCsvTemplate('himalayas_karakoram_csv', 'himalayas_karakoram_peaks.csv')}
                  className="px-2.5 py-1 rounded bg-slate-950 border border-amber-700/80 text-amber-300 hover:border-amber-500 transition-all text-[11px] font-medium cursor-pointer"
                >
                  🏔️ Himalayas & Karakoram (15 Peaks)
                </button>
                <button
                  onClick={() => handleLoadCsvTemplate('european_alps_csv', 'european_alps_summits.csv')}
                  className="px-2.5 py-1 rounded bg-slate-950 border border-cyan-700/80 text-cyan-300 hover:border-cyan-500 transition-all text-[11px] font-medium cursor-pointer"
                >
                  ⛷️ European Alps (15 Summits)
                </button>
                <button
                  onClick={() => handleLoadCsvTemplate('americas_rockies_andes_csv', 'americas_rockies_andes.csv')}
                  className="px-2.5 py-1 rounded bg-slate-950 border border-emerald-800 text-emerald-300 hover:border-emerald-600 transition-all text-[11px] font-medium cursor-pointer"
                >
                  🌲 Americas: Rockies & Andes (22 Corridors)
                </button>
                <button
                  onClick={() => handleLoadCsvTemplate('japan_oceania_scandi_csv', 'japan_oceania_scandinavia.csv')}
                  className="px-2.5 py-1 rounded bg-slate-950 border border-indigo-700/80 text-indigo-300 hover:border-indigo-500 transition-all text-[11px] font-medium cursor-pointer"
                >
                  🗾 Japan, NZ, Scandi & Caucasus (12 Peaks)
                </button>
            </div>

            {/* Drag and Drop Box & CSV Editor */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="space-y-2 relative"
            >
              {/* Textarea Toolbar */}
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
                <span className="font-mono text-[11px]">
                  CSV Text Data ({inputText.split('\n').filter((l) => l.trim()).length} rows detected)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyInput}
                    className="hover:text-emerald-400 text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 flex items-center gap-1 cursor-pointer"
                    title="Copy CSV text"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                  <button
                    onClick={() => {
                      setInputText('');
                      setUploadedFileName(null);
                    }}
                    className="hover:text-red-400 text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 flex items-center gap-1 cursor-pointer"
                    title="Clear editor"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* CSV Editor Textarea */}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste CSV rows here (e.g. location_id,latitude,longitude,elevation,slope,aspect,temperature,snowfall_24h...)"
                rows={15}
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-xl p-3 font-mono text-xs text-slate-100 placeholder-slate-600 focus:outline-none resize-y leading-relaxed shadow-inner"
                spellCheck={false}
              />
            </div>

            {/* Validation Feedback Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  {validation.isValid ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs font-mono">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>CSV PARSED & READY</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs font-mono">
                      <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>CSV VALIDATION ISSUES</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-300">
                    Rows: <strong className="text-emerald-400">{validation.recordCount}</strong>
                  </span>
                </div>
              </div>

              {/* Detected CSV Headers Pills */}
              {validation.detectedFields.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">
                    Mapped CSV Columns ({validation.detectedFields.length}):
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto no-scrollbar">
                    {validation.detectedFields.map((f) => (
                      <span
                        key={f}
                        className="bg-slate-900 text-emerald-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-emerald-900/60"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors & Warnings List */}
              {validation.errors.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-mono text-red-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                    <span>Errors ({validation.errors.length}):</span>
                  </div>
                  <ul className="space-y-0.5 text-[11px] text-red-300 font-mono max-h-24 overflow-y-auto pl-2 border-l-2 border-red-800">
                    {validation.errors.map((err, i) => (
                      <li key={i}>&bull; {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation.warnings.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-mono text-amber-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    <span>Warnings ({validation.warnings.length}):</span>
                  </div>
                  <ul className="space-y-0.5 text-[11px] text-amber-300/90 font-mono max-h-20 overflow-y-auto pl-2 border-l-2 border-amber-800">
                    {validation.warnings.map((w, i) => (
                      <li key={i}>&bull; {w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleRunInference}
              disabled={!validation.isValid || isEvaluating}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm shadow-lg transition-all cursor-pointer ${
                !validation.isValid || isEvaluating
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25 active:scale-[0.99]'
              }`}
            >
              {isEvaluating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Evaluating Avalanche Risk for {validation.recordCount} CSV Rows...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Avalanche Risk Inference ({validation.recordCount} CSV Rows)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Results & Batch Analytics Dashboard (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-3.5 min-w-0 w-full">
          {evaluatedRecords.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-4 flex flex-col items-center justify-center min-h-[420px]">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-inner">
                <FileSpreadsheet className="w-10 h-10 text-emerald-400/80 mx-auto" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <h3 className="text-base font-bold text-slate-200">Awaiting CSV Inference Execution</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Click a preset CSV button on the left or paste/upload your own CSV file, verify that the columns match, and click <strong>Run Avalanche Risk Inference</strong>.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center text-xs font-mono text-slate-400 pt-2">
                <button
                  onClick={downloadSampleCsvTemplate}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-emerald-400 px-3 py-1.5 rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Download Sample CSV Template</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 shadow-xl min-w-0">
              {/* Batch KPI Summary Banner */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2 min-w-0">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    EVALUATED CSV DATASET ({evaluatedRecords.length} LOCATIONS)
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1 bg-slate-950 hover:bg-slate-800 border border-emerald-700 text-emerald-300 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Export Evaluated CSV</span>
                  </button>
                </div>
              </div>

              {/* KPI Cards Grid */}
              {summaryStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">High Risk Rows</div>
                    <div className="text-xl font-black font-mono text-red-400">
                      {summaryStats.highCount} <span className="text-xs font-normal text-slate-400">({((summaryStats.highCount / summaryStats.total) * 100).toFixed(0)}%)</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">Medium Risk</div>
                    <div className="text-xl font-black font-mono text-amber-400">
                      {summaryStats.mediumCount} <span className="text-xs font-normal text-slate-400">({((summaryStats.mediumCount / summaryStats.total) * 100).toFixed(0)}%)</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">Low Risk</div>
                    <div className="text-xl font-black font-mono text-emerald-400">
                      {summaryStats.lowCount} <span className="text-xs font-normal text-slate-400">({((summaryStats.lowCount / summaryStats.total) * 100).toFixed(0)}%)</span>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                    <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">Max Risk Pass</div>
                    <div className="text-xs font-bold text-red-300 truncate">
                      {summaryStats.highestRiskLocation?.name || 'None'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Score: {summaryStats.highestRiskLocation?.score.toFixed(1) ?? 'N/A'}/100
                    </div>
                  </div>
                </div>
              )}

              {/* Filter & Search Toolbar */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search locations or coordinates in CSV..."
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded px-2.5 py-1 text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <button
                    onClick={() => setRiskFilter('ALL')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      riskFilter === 'ALL' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All ({evaluatedRecords.length})
                  </button>
                  <button
                    onClick={() => setRiskFilter('HIGH')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      riskFilter === 'HIGH' ? 'bg-red-600 text-white font-bold' : 'bg-slate-900 text-red-300 hover:text-red-100'
                    }`}
                  >
                    High ({summaryStats?.highCount ?? 0})
                  </button>
                  <button
                    onClick={() => setRiskFilter('MEDIUM')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      riskFilter === 'MEDIUM' ? 'bg-amber-600 text-white font-bold' : 'bg-slate-900 text-amber-300 hover:text-amber-100'
                    }`}
                  >
                    Medium ({summaryStats?.mediumCount ?? 0})
                  </button>
                  <button
                    onClick={() => setRiskFilter('LOW')}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      riskFilter === 'LOW' ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-900 text-emerald-300 hover:text-emerald-100'
                    }`}
                  >
                    Low ({summaryStats?.lowCount ?? 0})
                  </button>
                </div>
              </div>

              {/* Interactive Results Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 max-h-[480px]">
                <table className="w-full text-left text-xs font-mono divide-y divide-slate-800">
                  <thead className="bg-slate-900 text-slate-300 uppercase text-[10px] sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Location / Point</th>
                      <th className="p-2.5">Coordinates</th>
                      <th className="p-2.5">Slope</th>
                      <th className="p-2.5">24h Snow</th>
                      <th className="p-2.5">Max Wind</th>
                      <th className="p-2.5">Risk Level</th>
                      <th className="p-2.5">Score</th>
                      <th className="p-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {filteredRecords.map((r) => {
                      const isExpanded = expandedRowId === r.id;
                      const p = r.prediction;
                      return (
                        <React.Fragment key={r.id}>
                          <tr className="hover:bg-slate-900/60 transition-colors">
                            <td className="p-2.5 text-slate-500">{r.index}</td>
                            <td className="p-2.5 font-bold font-sans text-white">
                              <button
                                onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                                className="flex items-center gap-1 hover:text-emerald-300 text-left cursor-pointer"
                              >
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-emerald-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                                <span>{r.location_id}</span>
                              </button>
                            </td>
                            <td className="p-2.5 text-slate-400">{r.latitude.toFixed(3)}, {r.longitude.toFixed(3)}</td>
                            <td className="p-2.5">
                              <span className={r.slope >= 34 && r.slope <= 45 ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                                {r.slope}°
                              </span>
                            </td>
                            <td className="p-2.5">
                              <span className={(r.snowfall_24h ?? 0) >= 30 ? 'text-red-400 font-bold' : 'text-slate-300'}>
                                {r.snowfall_24h ?? 0}mm
                              </span>
                            </td>
                            <td className="p-2.5">{r.wind_speed_max_24h ?? 0}km/h</td>
                            <td className="p-2.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getRiskBadgeClasses(p?.final_risk_level)}`}>
                                {p?.final_risk_level ?? 'ERROR'}
                              </span>
                            </td>
                            <td className="p-2.5 font-bold text-emerald-400">
                              {p?.final_risk_score !== undefined && p.final_risk_score !== null ? `${p.final_risk_score.toFixed(1)}` : 'N/A'}
                            </td>
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => handleApplyToConsole(r)}
                                className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 px-2 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer"
                                title="Load this CSV point into main map console"
                              >
                                Apply
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Row Details */}
                          {isExpanded && (
                            <tr className="bg-slate-900/90 text-xs">
                              <td colSpan={9} className="p-3.5 space-y-2 border-l-2 border-emerald-500">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                    <span className="text-slate-400 block text-[10px]">Elevation / Aspect</span>
                                    <strong>{r.elevation}m / {r.aspect}°</strong>
                                  </div>
                                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                    <span className="text-slate-400 block text-[10px]">Temperature / SWE</span>
                                    <strong>{r.temperature}°C / {r.snow_water_equivalent ?? 0}mm</strong>
                                  </div>
                                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                    <span className="text-slate-400 block text-[10px]">72h Snow / Depth</span>
                                    <strong>{r.snowfall_72h ?? 0}mm / {r.snow_depth ?? 0}cm</strong>
                                  </div>
                                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                                    <span className="text-slate-400 block text-[10px]">Calibrated Probability</span>
                                    <strong className="text-amber-300">
                                      {p?.calibrated_probability ? `${(p.calibrated_probability * 100).toFixed(1)}%` : 'N/A'}
                                    </strong>
                                  </div>
                                </div>

                                {p?.risk_escalated && (
                                  <div className="bg-red-950/40 border border-red-900 p-2 rounded text-[11px] text-red-200">
                                    <span className="font-bold text-red-300">Safety Rule Triggered: </span>
                                    {p.risk_escalation_reasons.join('; ')}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Schema Reference Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-5 sm:p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">CSV Column Headers & Format Guide</h3>
              </div>
              <button
                onClick={() => setShowSchemaModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Your CSV file can use any of the column headers below. Missing optional columns are filled with standard mountain defaults automatically.
            </p>

            <div className="overflow-x-auto max-h-[440px] rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs font-mono divide-y divide-slate-800">
                <thead className="bg-slate-900 text-slate-300 uppercase text-[10px] sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5">Field Key</th>
                    <th className="p-2.5">Type / Unit</th>
                    <th className="p-2.5">Required</th>
                    <th className="p-2.5">Valid Range / Default</th>
                    <th className="p-2.5">Accepted Column Aliases</th>
                    <th className="p-2.5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {SUPPORTED_SCHEMA_FIELDS.map((f) => (
                    <tr key={f.key} className="hover:bg-slate-900/50">
                      <td className="p-2.5 font-bold text-emerald-300">{f.key}</td>
                      <td className="p-2.5 text-slate-400">{f.type} {f.unit ? `(${f.unit})` : ''}</td>
                      <td className="p-2.5">
                        {f.required ? (
                          <span className="text-red-400 font-bold">REQUIRED</span>
                        ) : (
                          <span className="text-slate-500">Optional</span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-400">
                        {f.min !== undefined && f.max !== undefined ? `[${f.min}, ${f.max}]` : '-'}
                        {f.defaultVal !== undefined ? ` (Def: ${f.defaultVal})` : ''}
                      </td>
                      <td className="p-2.5 text-slate-400 text-[11px]">
                        {f.aliases.join(', ')}
                      </td>
                      <td className="p-2.5 font-sans text-[11px] text-slate-300">{f.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <button
                onClick={downloadSampleCsvTemplate}
                className="bg-slate-950 border border-emerald-700 text-emerald-300 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <FileDown className="w-4 h-4" />
                <span>Download Sample CSV</span>
              </button>
              <button
                onClick={() => setShowSchemaModal(false)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
