import { useMemo } from 'react';
import type { Activity, SportFilter } from './types';

type LocationRecord = Record<string, string | null>;

const US_COUNTRY_NAMES = [
  'United States of America',
  'United States',
  '美国',
  '美國',
];

const US_STATE_ALIASES: [string, string[]][] = [
  ['Alabama', ['阿拉巴马州', '阿拉巴馬州']],
  ['Alaska', ['阿拉斯加州']],
  ['Arizona', ['亚利桑那州', '亞利桑那州']],
  ['Arkansas', ['阿肯色州']],
  ['California', ['加利福尼亚州', '加利福尼亞州']],
  ['Colorado', ['科罗拉多州', '科羅拉多州']],
  ['Connecticut', ['康涅狄格州']],
  ['Delaware', ['特拉华州', '德拉瓦州']],
  ['Florida', ['佛罗里达州', '佛羅里達州']],
  ['Georgia', ['佐治亚州', '喬治亞州']],
  ['Hawaii', ['夏威夷州']],
  ['Idaho', ['爱达荷州', '愛達荷州']],
  ['Illinois', ['伊利诺伊州', '伊利諾州']],
  ['Indiana', ['印第安纳州', '印第安納州']],
  ['Iowa', ['艾奥瓦州', '艾奧瓦州', '愛荷華州']],
  ['Kansas', ['堪萨斯州', '堪薩斯州']],
  ['Kentucky', ['肯塔基州']],
  ['Louisiana', ['路易斯安那州']],
  ['Maine', ['缅因州', '緬因州']],
  ['Maryland', ['马里兰州', '馬里蘭州']],
  ['Massachusetts', ['马萨诸塞州', '麻薩諸塞州']],
  ['Michigan', ['密歇根州']],
  ['Minnesota', ['明尼苏达州', '明尼蘇達州']],
  ['Mississippi', ['密西西比州']],
  ['Missouri', ['密苏里州', '密蘇里州']],
  ['Montana', ['蒙大拿州']],
  ['Nebraska', ['内布拉斯加州', '內布拉斯加州']],
  ['Nevada', ['内华达州', '內華達州']],
  ['New Hampshire', ['新罕布什尔州', '新罕布什爾州']],
  ['New Jersey', ['新泽西州', '新澤西州']],
  ['New Mexico', ['新墨西哥州']],
  ['New York', ['纽约州', '紐約州']],
  ['North Carolina', ['北卡罗来纳州', '北卡羅萊那州']],
  ['North Dakota', ['北达科他州', '北達科他州']],
  ['Ohio', ['俄亥俄州']],
  ['Oklahoma', ['俄克拉荷马州', '俄克拉荷馬州']],
  ['Oregon', ['俄勒冈州', '俄勒岡州']],
  ['Pennsylvania', ['宾夕法尼亚州', '賓夕法尼亞州']],
  ['Rhode Island', ['罗得岛州', '羅德島州']],
  ['South Carolina', ['南卡罗来纳州', '南卡羅萊那州']],
  ['South Dakota', ['南达科他州', '南達科他州']],
  ['Tennessee', ['田纳西州', '田納西州']],
  ['Texas', ['得克萨斯州', '德克薩斯州']],
  ['Utah', ['犹他州', '猶他州']],
  ['Vermont', ['佛蒙特州']],
  ['Virginia', ['弗吉尼亚州', '弗吉尼亞州']],
  ['Washington', ['华盛顿州', '華盛頓州']],
  ['West Virginia', ['西弗吉尼亚州', '西弗吉尼亞州']],
  ['Wisconsin', ['威斯康星州']],
  ['Wyoming', ['怀俄明州', '懷俄明州']],
  [
    'District of Columbia',
    ['哥伦比亚特区', '哥倫比亞特區', '华盛顿哥伦比亚特区'],
  ],
];

const STATE_MATCHERS = US_STATE_ALIASES.flatMap(([state, aliases]) =>
  [state, ...aliases].map((alias) => ({ state, alias }))
).sort((a, b) => b.alias.length - a.alias.length);

function parseLocationRecord(loc: string): LocationRecord | null {
  if (!loc.startsWith('{')) return null;
  try {
    return JSON.parse(
      loc.replace(/'/g, '"').replace(/None/g, 'null')
    ) as LocationRecord;
  } catch {
    return null;
  }
}

function canonicalCountry(country: string): string {
  if (US_COUNTRY_NAMES.some((name) => country.includes(name))) {
    return 'United States';
  }
  if (country.includes('中国') || country.includes('中國')) return 'China';
  if (country.includes('日本')) return 'Japan';
  if (country.includes('泰国') || country.includes('泰國')) return 'Thailand';
  return country;
}

export function extractCountry(loc: string | null): string | null {
  if (!loc || loc === 'None') return null;
  const record = parseLocationRecord(loc);
  if (record?.country) return canonicalCountry(record.country);
  if (US_COUNTRY_NAMES.some((name) => loc.includes(name))) {
    return 'United States';
  }
  if (loc.includes('中国') || loc.includes('中國')) return 'China';
  if (loc.includes('日本')) return 'Japan';
  if (loc.includes('泰国') || loc.includes('泰國')) return 'Thailand';
  return null;
}

export function extractUSState(loc: string | null): string | null {
  if (!loc) return null;
  const record = parseLocationRecord(loc);
  const searchable = [record?.state, record?.province, loc]
    .filter(Boolean)
    .join(' ');
  return (
    STATE_MATCHERS.find(({ alias }) => searchable.includes(alias))?.state ??
    null
  );
}

const ACTIVITY_NAME_TRANSLATIONS: [RegExp, string][] = [
  [/晨间跑步|清晨跑步|跑步（上午）/g, 'Morning Run'],
  [/午间跑步/g, 'Noon Run'],
  [/午后跑步/g, 'Afternoon Run'],
  [/傍晚跑步/g, 'Evening Run'],
  [/晚间跑步|跑步（夜间）|跑步（晚上）/g, 'Night Run'],
  [/室内跑步/g, 'Indoor Running'],
  [/户外跑步/g, 'Outdoor Running'],
  [/晨间行走/g, 'Morning Walk'],
  [/傍晚行走/g, 'Evening Walk'],
  [/锻炼（上午）/g, 'Morning Workout'],
  [/锻炼（晚上）/g, 'Evening Workout'],
  [/测试/g, 'Test'],
];

function defaultActivityName(type: string): string {
  const names: Record<string, string> = {
    Run: 'Run',
    Ride: 'Ride',
    Hike: 'Hike',
    Walk: 'Walk',
    Training: 'Training',
    WeightTraining: 'Weight Training',
    Workout: 'Workout',
    StairStepper: 'Stair Stepper',
    WaterSport: 'Water Sport',
  };
  return names[type] ?? 'Activity';
}

export function formatActivityName(
  name: string | null | undefined,
  type: string
): string {
  if (!name) return defaultActivityName(type);
  const translated = ACTIVITY_NAME_TRANSLATIONS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    name
  );
  return translated;
}

export function useFilteredActivities(
  activities: Activity[],
  filter: SportFilter,
  year: number | null
) {
  return useMemo(() => {
    let filtered = activities;
    if (filter !== 'all') {
      filtered = filtered.filter((a) => a.type === filter);
    }
    if (year) {
      filtered = filtered.filter((a) => {
        const d = new Date(a.start_date_local);
        return d.getFullYear() === year;
      });
    }
    return filtered;
  }, [activities, filter, year]);
}

export function parseMovingTime(time: string): number {
  if (!time) return 0;
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(1);
}

export function formatPace(speedMs: number): string {
  if (!speedMs || speedMs <= 0) return '--';
  const paceMin = 1000 / 60 / speedMs;
  const min = Math.floor(paceMin);
  const sec = Math.round((paceMin - min) * 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function formatDuration(timeStr: string): string {
  const secs = parseMovingTime(timeStr);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function getAvailableYears(activities: Activity[]): number[] {
  const years = new Set(
    activities.map((a) => new Date(a.start_date_local).getFullYear())
  );
  return Array.from(years).sort((a, b) => b - a);
}
