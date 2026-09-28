/**
 * Unit tests for src/services/taskService.js
 *
 * These call the service functions directly (no HTTP) and assert on
 * *behaviour* (what a caller would expect), not on implementation details.
 * Tests marked [BUG] encode the CORRECT behaviour; they failed against the
 * original code and are documented in BUG_REPORT.md.
 */
const service = require('../src/services/taskService');

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (d) => new Date(Date.now() + d * DAY).toISOString();

beforeEach(() => service._reset());

describe('create', () => {
  test('applies defaults for optional fields', () => {
    const t = service.create({ title: 'Write tests' });
    expect(t).toMatchObject({
      title: 'Write tests',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      completedAt: null,
      assignee: null,
    });
    expect(typeof t.id).toBe('string');
    expect(Number.isNaN(Date.parse(t.createdAt))).toBe(false);
  });

  test('generates a unique id per task', () => {
    const a = service.create({ title: 'a' });
    const b = service.create({ title: 'b' });
    expect(a.id).not.toBe(b.id);
  });

  test('respects explicitly supplied fields', () => {
    const due = daysFromNow(3);
    const t = service.create({ title: 'x', description: 'd', status: 'in_progress', priority: 'high', dueDate: due });
    expect(t).toMatchObject({ description: 'd', status: 'in_progress', priority: 'high', dueDate: due });
  });
});

describe('getAll / findById', () => {
  test('getAll returns every task', () => {
    service.create({ title: 'a' });
    service.create({ title: 'b' });
    expect(service.getAll()).toHaveLength(2);
  });

  test('getAll returns a copy: mutating the array does not affect the store', () => {
    service.create({ title: 'a' });
    service.getAll().pop();
    expect(service.getAll()).toHaveLength(1);
  });

  test('findById returns the task, or undefined when missing', () => {
    const t = service.create({ title: 'a' });
    expect(service.findById(t.id)).toEqual(t);
    expect(service.findById('nope')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  beforeEach(() => {
    service.create({ title: 'a', status: 'todo' });
    service.create({ title: 'b', status: 'in_progress' });
    service.create({ title: 'c', status: 'done' });
    service.create({ title: 'd', status: 'done' });
  });

  test('returns only tasks with that exact status', () => {
    expect(service.getByStatus('done').map((t) => t.title)).toEqual(['c', 'd']);
    expect(service.getByStatus('in_progress')).toHaveLength(1);
  });

  test('[BUG] does not do substring matching ("do" must not match "todo"/"done")', () => {
    expect(service.getByStatus('do')).toEqual([]);
    expect(service.getByStatus('progress')).toEqual([]);
  });

  test('returns [] for an unknown status', () => {
    expect(service.getByStatus('archived')).toEqual([]);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 25; i++) service.create({ title: `task ${i}` });
  });

  test('[BUG] page 1 is the FIRST page (1-indexed)', () => {
    const page = service.getPaginated(1, 10);
    expect(page).toHaveLength(10);
    expect(page[0].title).toBe('task 1');
    expect(page[9].title).toBe('task 10');
  });

  test('[BUG] page 2 continues where page 1 ended', () => {
    const page = service.getPaginated(2, 10);
    expect(page[0].title).toBe('task 11');
  });

  test('last page is partial', () => {
    const page = service.getPaginated(3, 10);
    expect(page).toHaveLength(5);
    expect(page[4].title).toBe('task 25');
  });

  test('a page past the end is empty', () => {
    expect(service.getPaginated(4, 10)).toEqual([]);
  });

  test('can paginate within a status filter', () => {
    service._reset();
    for (let i = 1; i <= 5; i++) service.create({ title: `d${i}`, status: 'done' });
    for (let i = 1; i <= 5; i++) service.create({ title: `t${i}`, status: 'todo' });
    const page = service.getPaginated(1, 3, 'done');
    expect(page.map((t) => t.title)).toEqual(['d1', 'd2', 'd3']);
  });
});

describe('getStats', () => {
  test('all zeros when empty', () => {
    expect(service.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  test('counts by status', () => {
    service.create({ title: 'a', status: 'todo' });
    service.create({ title: 'b', status: 'todo' });
    service.create({ title: 'c', status: 'in_progress' });
    service.create({ title: 'd', status: 'done' });
    expect(service.getStats()).toMatchObject({ todo: 2, in_progress: 1, done: 1, overdue: 0 });
  });

  test('overdue = past due date AND not done', () => {
    service.create({ title: 'late todo', dueDate: daysFromNow(-2) });
    service.create({ title: 'late wip', status: 'in_progress', dueDate: daysFromNow(-1) });
    service.create({ title: 'late but done', status: 'done', dueDate: daysFromNow(-5) });
    service.create({ title: 'future', dueDate: daysFromNow(5) });
    service.create({ title: 'no due date' });
    expect(service.getStats().overdue).toBe(2);
  });
});

describe('update', () => {
  test('merges the supplied fields into the task', () => {
    const t = service.create({ title: 'old' });
    const u = service.update(t.id, { title: 'new', priority: 'high' });
    expect(u).toMatchObject({ id: t.id, title: 'new', priority: 'high', status: 'todo' });
    expect(service.findById(t.id).title).toBe('new');
  });

  test('returns null for a missing task', () => {
    expect(service.update('nope', { title: 'x' })).toBeNull();
  });

  test('[BUG] cannot overwrite server-managed fields (id, createdAt, completedAt, assignee)', () => {
    const t = service.create({ title: 'a' });
    const u = service.update(t.id, {
      id: 'hacked',
      createdAt: '1999-01-01T00:00:00.000Z',
      completedAt: '1999-01-01T00:00:00.000Z',
      assignee: 'mallory',
      title: 'still updates',
    });
    expect(u.id).toBe(t.id);
    expect(u.createdAt).toBe(t.createdAt);
    expect(u.completedAt).toBeNull();
    expect(u.assignee).toBeNull();
    expect(u.title).toBe('still updates');
    expect(service.findById(t.id)).toBeDefined();
    expect(service.findById('hacked')).toBeUndefined();
  });
});

describe('completedAt consistency on update', () => {
  test('[BUG] PUT status -> done stamps completedAt', () => {
    const t = service.create({ title: 'a' });
    const u = service.update(t.id, { status: 'done' });
    expect(Number.isNaN(Date.parse(u.completedAt))).toBe(false);
  });

  test('[BUG] moving a task out of done clears completedAt', () => {
    const t = service.create({ title: 'a' });
    service.update(t.id, { status: 'done' });
    const u = service.update(t.id, { status: 'in_progress' });
    expect(u.completedAt).toBeNull();
  });

  test('updating other fields of a done task keeps completedAt', () => {
    const t = service.create({ title: 'a' });
    const done = service.update(t.id, { status: 'done' });
    const u = service.update(t.id, { title: 'renamed', status: 'done' });
    expect(u.completedAt).toBe(done.completedAt);
  });
});

describe('remove', () => {
  test('removes an existing task and returns true', () => {
    const t = service.create({ title: 'a' });
    expect(service.remove(t.id)).toBe(true);
    expect(service.getAll()).toHaveLength(0);
  });

  test('returns false for a missing task', () => {
    expect(service.remove('nope')).toBe(false);
  });
});

describe('completeTask', () => {
  test('marks the task done and stamps completedAt', () => {
    const t = service.create({ title: 'a' });
    const c = service.completeTask(t.id);
    expect(c.status).toBe('done');
    expect(Number.isNaN(Date.parse(c.completedAt))).toBe(false);
    expect(service.findById(t.id).status).toBe('done');
  });

  test('[BUG] keeps the task priority (does not reset it to "medium")', () => {
    const high = service.create({ title: 'h', priority: 'high' });
    const low = service.create({ title: 'l', priority: 'low' });
    expect(service.completeTask(high.id).priority).toBe('high');
    expect(service.completeTask(low.id).priority).toBe('low');
  });

  test('[BUG] completing twice keeps the original completedAt', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
      const t = service.create({ title: 'a' });
      const first = service.completeTask(t.id);
      jest.setSystemTime(new Date('2030-06-01T00:00:00.000Z'));
      const second = service.completeTask(t.id);
      expect(second.completedAt).toBe(first.completedAt);
    } finally {
      jest.useRealTimers();
    }
  });

  test('returns null for a missing task', () => {
    expect(service.completeTask('nope')).toBeNull();
  });
});

describe('assignTask', () => {
  test('stores the assignee on the task and returns it', () => {
    const t = service.create({ title: 'a' });
    const a = service.assignTask(t.id, 'Asha');
    expect(a.assignee).toBe('Asha');
    expect(service.findById(t.id).assignee).toBe('Asha');
  });

  test('re-assigning replaces the previous assignee', () => {
    const t = service.create({ title: 'a' });
    service.assignTask(t.id, 'Asha');
    expect(service.assignTask(t.id, 'Ravi').assignee).toBe('Ravi');
  });

  test('does not touch other fields', () => {
    const t = service.create({ title: 'a', priority: 'high', status: 'in_progress' });
    const a = service.assignTask(t.id, 'Asha');
    expect(a).toMatchObject({ title: 'a', priority: 'high', status: 'in_progress', id: t.id });
  });

  test('returns null for a missing task', () => {
    expect(service.assignTask('nope', 'Asha')).toBeNull();
  });
});
