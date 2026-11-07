export const C = {
  bg: '#0B0F14',
  sidebar: '#0F151C',
  card: '#151C25',
  cardAlt: '#1B2430',
  border: '#232E3B',
  text: '#E8EEF5',
  sub: '#93A1B2',
  faint: '#5D6B7C',
  recovery: { green: '#2FD48A', yellow: '#F5C542', red: '#F2545B' },
  strain: '#3EA6FF',
  sleep: '#9B7BFF',
  deep: '#5B3FD6',
  rem: '#A98BFF',
  core: '#6C8DFF',
  awake: '#F08A5D',
  hrv: '#2FD4C4',
  rhr: '#FF6B8A',
  protein: '#FF8C5A',
  carbs: '#3EA6FF',
  fat: '#F5C542',
  premium: '#F5B83D',
  accent: '#2FD48A',
};

export const ZONE_COLORS = ['#6B7C93', '#3EA6FF', '#2FD48A', '#F5C542', '#F2545B'];

export function recoveryColor(score: number | null | undefined): string {
  if (score == null) return C.faint;
  return score >= 67 ? C.recovery.green : score >= 34 ? C.recovery.yellow : C.recovery.red;
}

export const font = {
  family: 'Segoe UI, system-ui, -apple-system, Roboto, sans-serif',
};
