export interface Activity {
  run_id: number;
  name: string;
  distance: number; // in meters
  moving_time: string; // "H:MM:SS" or "MM:SS"
  type: 'Run' | string;
  subtype?: string;
  start_date: string;
  start_date_local: string;
  location_country: string | null;
  summary_polyline: string | null;
  average_heartrate: number | null;
  average_speed: number; // m/s
  elevation_gain: number | null;
  source?: string;
  streak?: number;
}

export type SportFilter = 'all' | 'Run';
