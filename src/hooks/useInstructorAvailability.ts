import { useEffect, useState } from 'react';
import type { PublicInstructorSummary } from '../services/instructorTests';
export function instructorAvailability(test: Pick<PublicInstructorSummary, 'opens_at' | 'closes_at'> | null, now: number): 'open' | 'scheduled' | 'closed' {
  if (!test?.opens_at || !test.closes_at) return 'open';
  if (now < Date.parse(test.opens_at)) return 'scheduled';
  return now >= Date.parse(test.closes_at) ? 'closed' : 'open';
}
export default function useInstructorAvailability(test: PublicInstructorSummary | null) {
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  useEffect(() => { setOffset(test?.server_time ? Date.parse(test.server_time) - Date.now() : 0); }, [test]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return instructorAvailability(test, now + offset);
}
export const formatInstructorSchedule = (iso: string) => new Intl.DateTimeFormat('es-HN', { timeZone: 'America/Tegucigalpa', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
