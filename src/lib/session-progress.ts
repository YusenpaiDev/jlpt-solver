/** Shared definition used by home, history and statistics. */
export interface ProgressSession {
  kind?: string | null;
  total: number; score: number | null; created_at: string;
  stats?: { answered?: number; correct?: number; last_practiced_at?: string } | null;
}
export function answeredCount(s: ProgressSession) {
  return Math.max(0, Math.min(s.total || 0, s.stats?.answered ?? (s.score != null ? s.total : 0)));
}
export function correctCount(s: ProgressSession) {
  return Math.max(0, Math.min(answeredCount(s), s.stats?.correct ?? s.score ?? 0));
}
export function practiced(s: ProgressSession) { return answeredCount(s) > 0; }
export function activityAt(s: ProgressSession) {
  const at = s.stats?.last_practiced_at;
  return at && Number.isFinite(Date.parse(at)) ? at : s.created_at;
}
export function recentPractice<T extends ProgressSession>(sessions: T[]): T[] {
  return sessions.filter(practiced).sort((a,b) => Date.parse(activityAt(b))-Date.parse(activityAt(a)));
}

export function hasPracticeDate(s: ProgressSession) {
  return Boolean(s.stats?.last_practiced_at && Number.isFinite(Date.parse(s.stats.last_practiced_at))) || s.kind !== "materi";
}

export function accuracyPercent(sessions: ProgressSession[]) {
  const answered = sessions.reduce((sum,s) => sum + answeredCount(s),0);
  return answered ? Math.round(sessions.reduce((sum,s)=>sum+correctCount(s),0)/answered*100) : null;
}

/** null means the daily source is unavailable; an empty successful result is authoritative. */
export function dailyActivity(sessions: ProgressSession[], records: {tanggal:string;jumlah:number}[] | null) {
  const days: Record<string,number> = {};
  if (records !== null) {
    for (const row of records) days[row.tanggal] = row.jumlah;
  } else {
    for (const session of sessions) {
      if (!practiced(session) || !hasPracticeDate(session)) continue;
      const d = new Date(activityAt(session));
      const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      days[date] = (days[date] ?? 0) + answeredCount(session);
    }
  }
  return days;
}
