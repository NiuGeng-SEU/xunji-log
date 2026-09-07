import { useState, useMemo } from 'react';
import type { Activity, SportFilter } from './types';
import {
  formatActivityName,
  formatDuration,
  formatPace,
  parseMovingTime,
} from './utils';
import { calculateRunningTier } from './runningStandards';
import { useLanguage } from '../../language';

interface ActivityLogProps {
  activities: Activity[];
  years: number[];
  year: number | null;
  setYear: (y: number | null) => void;
  selectedActivity?: Activity | null;
  onSelectActivity?: (a: Activity | null) => void;
  filter?: SportFilter;
}

const PAGE_SIZE = 16;

type DistanceFilter = 'all' | '10' | '20' | '40';

function typeIcon(type: string): string {
  const icons: Record<string, string> = {
    Run: '🏃',
    Ride: '🚴',
    Hike: '🥾',
    Walk: '🚶',
  };
  return icons[type] ?? '🏃';
}

export function ActivityLog({
  activities,
  years,
  year,
  setYear,
  selectedActivity,
  onSelectActivity,
}: ActivityLogProps) {
  const { t, language } = useLanguage();
  const isZh = language === 'zh';
  const [page, setPage] = useState(0);
  const [distFilter, setDistFilter] = useState<DistanceFilter>('all');

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      // 1. Year filter
      if (year !== null) {
        const itemYear = Number(a.start_date_local.slice(0, 4));
        if (itemYear !== year) return false;
      }

      // 2. Distance filter
      const km = a.distance / 1000;
      switch (distFilter) {
        case '10':
          return km >= 10;
        case '20':
          return km >= 20;
        case '40':
          return km >= 40;
        default:
          return true;
      }
    });
  }, [activities, year, distFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort(
      (a, b) =>
        new Date(b.start_date_local).getTime() -
        new Date(a.start_date_local).getTime()
    );
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const handleYearSelect = (y: number | null) => {
    setYear(y);
    setPage(0);
  };

  const handleDistSelect = (d: DistanceFilter) => {
    setDistFilter(d);
    setPage(0);
  };

  return (
    <div className="cardio-subcard run-log-card">
      {/* Header */}
      <div className="run-log-header">
        <h3 className="run-log-title">{t('Cardio Log', '有氧训练日志')}</h3>
        <span className="run-log-showing">
          {t('Showing', '显示')}{' '}
          {sorted.length > 0 ? currentPage * PAGE_SIZE + 1 : 0}-
          {Math.min((currentPage + 1) * PAGE_SIZE, sorted.length)} {t('of', '/ 共')}{' '}
          {sorted.length}
        </span>
      </div>

      {/* Year filter pills */}
      <div className="filter-pills-row">
        <button
          type="button"
          onClick={() => handleYearSelect(null)}
          className={`filter-pill ${year === null ? 'active' : ''}`}
        >
          {t('All', '全部年份')}
        </button>
        {years.map((y) => (
          <button
            type="button"
            key={y}
            onClick={() => handleYearSelect(y)}
            className={`filter-pill ${year === y ? 'active' : ''}`}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Distance filter pills */}
      <div className="filter-pills-row distance-pills">
        {(
          [
            ['all', t('All Distances', '全部距离')],
            ['10', '10km+'],
            ['20', '20km+'],
            ['40', '40km+'],
          ] as [DistanceFilter, string][]
        ).map(([val, label]) => (
          <button
            type="button"
            key={val}
            onClick={() => handleDistSelect(val)}
            className={`filter-pill ${distFilter === val ? 'active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="run-log-table-wrap">
        <table className="run-log-table">
          <thead>
            <tr>
              <th>{t('DATE', '日期')}</th>
              <th>{t('TYPE', '类型')}</th>
              <th>{t('NAME', '名称')}</th>
              <th>{t('DISTANCE', '里程')}</th>
              <th>{t('DURATION', '时长')}</th>
              <th>{t('PACE', '配速')}</th>
              <th>{t('HR', '心率')}</th>
              <th>{t('DEGREE', '水准段位')}</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((a) => {
              const isSelected = selectedActivity?.run_id === a.run_id;
              const isRun = a.type === 'Run';
              const movingSec = parseMovingTime(a.moving_time);
              const tier = isRun ? calculateRunningTier(a.distance, movingSec) : null;

              return (
                <tr
                  key={a.run_id}
                  onClick={() => onSelectActivity?.(isSelected ? null : a)}
                  className={`run-log-row ${isSelected ? 'selected' : ''}`}
                >
                  <td className="cell-date">
                    {a.start_date_local.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="cell-type">
                    <span className="type-tag">
                      {typeIcon(a.type)} {a.type}
                    </span>
                  </td>
                  <td className="cell-name">{formatActivityName(a.name, a.type)}</td>
                  <td className="cell-dist">
                    {(a.distance / 1000).toFixed(1)} <span className="unit-label">km</span>
                  </td>
                  <td className="cell-duration">
                    {formatDuration(a.moving_time)}
                  </td>
                  <td className="cell-pace">
                    {formatPace(a.average_speed)}
                  </td>
                  <td className="cell-hr">
                    {a.average_heartrate ? Math.round(a.average_heartrate) : '--'}
                  </td>
                  <td className="cell-tier">
                    {tier ? (
                      <span
                        className="log-tier-badge"
                        style={{
                          color: tier.color,
                          backgroundColor: `${tier.color}15`,
                          borderColor: `${tier.color}40`,
                        }}
                        title={`等效5K: ${Math.floor((tier.equivalent5kSec || 0) / 60)}:${String((tier.equivalent5kSec || 0) % 60).padStart(2, '0')}`}
                      >
                        {isZh ? tier.tierNameZh : tier.tierNameEn} · {tier.percentile}%
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-6 text-muted">
                  {t('No matching activities found', '无匹配的活动记录')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="run-log-pagination">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="pagination-btn"
          >
            {t('Previous', '上一页')}
          </button>
          <span className="pagination-info">
            {t('Page', '第')} {currentPage + 1} / {totalPages} {t('', '页')}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="pagination-btn"
          >
            {t('Next', '下一页')}
          </button>
        </div>
      )}
    </div>
  );
}
