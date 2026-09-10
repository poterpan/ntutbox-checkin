import { describe, it, expect } from 'vitest';
import { chooseProjectorTarget, type ProjectorSession } from '../projector-target';

const s = (
  session_id: string,
  course_name: string,
  class_date: string,
  created_at: number,
): ProjectorSession => ({
  session_id,
  course_id: `course-${session_id}`,
  course_name,
  class_date,
  qr_mode: 'dynamic',
  created_at,
});

const TODAY = '2026-09-10';

describe('chooseProjectorTarget', () => {
  it('reports none when there are no open sessions at all', () => {
    expect(chooseProjectorTarget([], TODAY)).toEqual({ kind: 'none' });
  });

  it('ignores stale sessions left open from earlier days', () => {
    const stale = s('old', '專題討論', '2026-09-03', 1);
    expect(chooseProjectorTarget([stale], TODAY)).toEqual({ kind: 'none' });
  });

  it('goes straight to the only session open today', () => {
    const only = s('a', '專題討論', TODAY, 10);
    expect(chooseProjectorTarget([only], TODAY)).toEqual({ kind: 'single', session: only });
  });

  // The reason this function exists: two courses can each hold one session on
  // the same day (the per-course UNIQUE(course_id, class_date) does not stop
  // that), and silently taking the newest meant whichever was opened first got
  // shadowed.
  it('asks which one when two courses are open on the same day', () => {
    const seminar = s('a', '專題討論', TODAY, 10);
    const event = s('b', '特殊活動簽到', TODAY, 20);

    expect(chooseProjectorTarget([seminar, event], TODAY)).toEqual({
      kind: 'choose',
      sessions: [seminar, event],
    });
  });

  it('offers them in the order they were opened, regardless of input order', () => {
    const first = s('a', '先開的', TODAY, 10);
    const second = s('b', '後開的', TODAY, 20);
    const third = s('c', '最後開的', TODAY, 30);

    const target = chooseProjectorTarget([third, first, second], TODAY);

    expect(target.kind).toBe('choose');
    if (target.kind !== 'choose') throw new Error('expected choose');
    expect(target.sessions.map((x) => x.session_id)).toEqual(['a', 'b', 'c']);
  });

  it('does not let a stale session turn a single into a choice', () => {
    const stale = s('old', '上週的', '2026-09-03', 1);
    const today = s('a', '今天的', TODAY, 10);

    expect(chooseProjectorTarget([stale, today], TODAY)).toEqual({
      kind: 'single',
      session: today,
    });
  });
});
