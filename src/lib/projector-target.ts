/**
 * Decides what /projector should do with the caller's open sessions.
 *
 * `sessions` UNIQUE(course_id, class_date) allows only one session per course
 * per day, but /api/sessions/open spans every course the viewer administers —
 * so a day can legitimately hold several. Picking one implicitly (it used to
 * take the newest created_at) meant the session opened first was shadowed with
 * no way to reach it from the projector, so more than one now asks.
 */

export type ProjectorSession = {
  session_id: string;
  course_id: string;
  course_name: string;
  class_date: string;
  qr_mode: string;
  created_at: number;
};

export type ProjectorTarget =
  | { kind: 'none' }
  | { kind: 'single'; session: ProjectorSession }
  | { kind: 'choose'; sessions: ProjectorSession[] };

/** `today` is a local calendar date, 'YYYY-MM-DD', matching sessions.class_date. */
export function chooseProjectorTarget(
  sessions: ProjectorSession[],
  today: string,
): ProjectorTarget {
  // Sessions left open from earlier days are intentionally ignored rather than
  // offered — they are forgotten sessions, not something to project.
  const todays = sessions
    .filter((s) => s.class_date === today)
    .sort((a, b) => a.created_at - b.created_at);

  if (todays.length === 0) return { kind: 'none' };
  if (todays.length === 1) return { kind: 'single', session: todays[0] };
  return { kind: 'choose', sessions: todays };
}
