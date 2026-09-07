import { useMemo, useState } from 'react';
import type { Activity } from './types';
import { parseMovingTime } from './utils';
import {
  calculateSpecificDistanceTier,
  predictPBsFromLastMonth,
  RUNNING_BENCHMARKS,
} from './runningStandards';
import { useLanguage } from '../../language';

interface PersonalBestProps {
  activities: Activity[];
  onSelectActivity?: (a: Activity | null) => void;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPace(secondsPerKm: number): string {
  if (secondsPerKm <= 0) return '--';
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.floor(secondsPerKm % 60);
  return `${m}'${String(s).padStart(2, '0')}"`;
}

const DISTANCES: { key: keyof typeof RUNNING_BENCHMARKS; min: number; max: number }[] = [
  { key: '5K', min: 4.8, max: 5.5 },
  { key: '10K', min: 9.5, max: 11 },
  { key: 'Half Marathon', min: 20, max: 22.5 },
  { key: 'Marathon', min: 41, max: 44 },
];

export function PersonalBest({ activities, onSelectActivity }: PersonalBestProps) {
  const { t, language } = useLanguage();
  const isZh = language === 'zh';
  const [selectedYear, setSelectedYear] = useState<number | 'past_year' | 'all'>('past_year');

  const years = useMemo(() => {
    const yearsSet = new Set<number>();
    for (const a of activities) {
      if (a.type === 'Run' && a.distance > 0) {
        const y = Number(a.start_date_local.slice(0, 4));
        if (!isNaN(y) && y > 2000) yearsSet.add(y);
      }
    }
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [activities]);

  // Filtered runs based on selected year (default Past Year / last 12 months)
  const filteredRuns = useMemo(() => {
    const allRuns = activities.filter((a) => a.type === 'Run' && a.distance > 0);
    if (selectedYear === 'all') return allRuns;
    if (typeof selectedYear === 'number') {
      const prefix = String(selectedYear);
      return allRuns.filter((a) => a.start_date_local.startsWith(prefix));
    }
    // 'past_year': last 12 months
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneYearAgoStr = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}-${String(oneYearAgo.getDate()).padStart(2, '0')}`;
    return allRuns.filter((a) => a.start_date_local.slice(0, 10) >= oneYearAgoStr);
  }, [activities, selectedYear]);

  // Personal Bests for selected period
  const bests = useMemo(() => {
    return DISTANCES.map(({ key, min, max }) => {
      const matching = filteredRuns.filter((a) => {
        const km = a.distance / 1000;
        if (km < min || km > max) return false;
        const time = parseMovingTime(a.moving_time);
        const pacePerKm = time / km;
        return pacePerKm >= 180 && pacePerKm <= 720;
      });
      if (matching.length === 0) {
        return { key, activity: null, time: 0, tier: null };
      }
      const best = matching.reduce((b, a) => {
        return parseMovingTime(a.moving_time) < parseMovingTime(b.moving_time) ? a : b;
      });
      const time = parseMovingTime(best.moving_time);
      const tier = calculateSpecificDistanceTier(key, time);
      return { key, activity: best, time, tier };
    });
  }, [filteredRuns]);

  const periodLabel = useMemo(() => {
    if (selectedYear === 'past_year') return t('Past Year Records', '近一年最佳');
    if (selectedYear === 'all') return t('All-Time Records', '历史个人最佳');
    return `${selectedYear} ${t('Records', '年度最佳')}`;
  }, [selectedYear, t]);

  // Last Month Predicted PBs
  const prediction = useMemo(() => predictPBsFromLastMonth(activities), [activities]);

  return (
    <div className="cardio-subcard personal-best-card">
      <div className="personal-best-header-row">
        <h3 className="personal-best-title">
          <svg
            className="sparkle-icon"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
          <span>{t('Personal Best & Race Prediction', '个人最佳与成绩预测')}</span>
        </h3>
        <nav className="chart-years-nav" aria-label={t('Year filter', '年份筛选')}>
          <button
            type="button"
            className={selectedYear === 'past_year' ? 'active' : ''}
            onClick={() => setSelectedYear('past_year')}
          >
            {t('Past Year', '近一年')}
          </button>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              className={selectedYear === y ? 'active' : ''}
              onClick={() => setSelectedYear(y)}
            >
              {y}
            </button>
          ))}
          <button
            type="button"
            className={selectedYear === 'all' ? 'active' : ''}
            onClick={() => setSelectedYear('all')}
          >
            {t('All', '全部')}
          </button>
        </nav>
      </div>

      {/* 1. Personal Bests for selected period */}
      <div className="pb-section">
        <div className="pb-section-header">
          <h4 className="pb-section-subtitle">
            <span className="pb-section-dot pb-dot-alltime" />
            <span>{periodLabel}</span>
          </h4>
        </div>

        <div className="personal-best-grid">
          {bests.map(({ key, activity, time, tier }) => (
            <div
              key={key}
              className={`personal-best-item${activity ? ' has-record' : ''}`}
              onClick={() => activity && onSelectActivity?.(activity)}
              title={
                activity
                  ? `${activity.start_date_local.slice(0, 10)} (${activity.name})`
                  : undefined
              }
            >
              <div className="pb-top-row">
                <span className="pb-distance-label">{key}</span>
                {tier && (
                  <span
                    className="pb-tier-badge"
                    style={{
                      color: tier.color,
                      backgroundColor: `${tier.color}15`,
                      borderColor: `${tier.color}40`,
                    }}
                  >
                    {isZh ? tier.tierNameZh : tier.tierNameEn} · {tier.percentile}%
                  </span>
                )}
              </div>
              <span className={`pb-time-val ${activity ? 'active' : 'empty'}`}>
                {activity ? formatTime(time) : '--'}
              </span>
              <div className="pb-bottom-meta">
                {activity ? (
                  <>
                    <span className="pb-date-meta">{activity.start_date_local.slice(0, 10)}</span>
                    <span className="pb-pace-meta">
                      {formatPace(time / (activity.distance / 1000))}/km
                    </span>
                  </>
                ) : (
                  <span className="pb-date-meta text-muted">{t('No record', '暂无记录')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Predicted PBs (Last Month Form) */}
      <div className="pb-section pb-prediction-section">
        <div className="pb-section-header">
          <h4 className="pb-section-subtitle">
            <span className="pb-section-dot pb-dot-predicted" />
            <span>{t('Predicted PB', '预测 PB')}</span>
          </h4>
          {prediction.baseActivity && (
            <span className="prediction-basis-badge">
              {t('Basis', '基准')}: <strong>{prediction.baseActivity.date}</strong> ·{' '}
              <strong>{prediction.baseActivity.distanceKm} km</strong> in{' '}
              <strong>{prediction.baseActivity.durationMin} min</strong> ({t('pace', '配速')}{' '}
              {formatPace(prediction.baseActivity.paceSec)}/km)
            </span>
          )}
        </div>

        <div className="personal-best-grid">
          {prediction.predictions.map((p) => (
            <div key={p.key} className="personal-best-item predicted-item has-record">
              <div className="pb-top-row">
                <span className="pb-distance-label">{p.key}</span>
                <span
                  className="pb-tier-badge"
                  style={{
                    color: p.tier.color,
                    backgroundColor: `${p.tier.color}15`,
                    borderColor: `${p.tier.color}40`,
                  }}
                >
                  {isZh ? p.tier.tierNameZh : p.tier.tierNameEn} · {p.tier.percentile}%
                </span>
              </div>
              <span className="pb-time-val predicted-time">
                {formatTime(p.predictedTimeSec)}
              </span>
              <div className="pb-bottom-meta">
                <span className="pb-pred-label">{t('Est. Pace', '预估配速')}</span>
                <span className="pb-pace-meta">
                  {formatPace(p.predictedPaceSec)}/km
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
