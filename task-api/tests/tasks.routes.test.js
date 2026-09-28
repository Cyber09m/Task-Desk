/**
 * Integration tests for the HTTP API (Supertest against the Express app).
 * Tests marked [BUG] assert the CORRECT behaviour; see BUG_REPORT.md.
 */
const request = require('supertest');
const app = require('../src/app');
const service = require('../src/services/taskService');

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString();

beforeEach(() => service._reset());

const createTask = (body = { title: 'Sample' }) => request(app).post('/tasks').send(body);

describe('POST /tasks', () => {
  test('201 + created task on the happy path', async () => {
    const res = await createTask({ title: 'Write tests', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Write tests', priority: 'high', status: 'todo', assignee: null });
    expect(res.body.id).toBeDefined();
  });

  test('400 when title is missing', async () => {
    const res = await createTask({ priority: 'low' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  test('400 for invalid status, priority and dueDate', async () => {
    expect((await createTask({ title: 'a', status: 'pending' })).status).toBe(400);
    expect((await createTask({ title: 'a', priority: 'urgent' })).status).toBe(400);
    expect((await createTask({ title: 'a', dueDate: 'tomorrow-ish' })).status).toBe(400);
  });

  test('[BUG] malformed JSON returns 400 (client error), not 500', async () => {
    const res = await request(app).post('/tasks').set('Content-Type', 'application/json').send('{"title": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/json/i);
  });
});

describe('GET /tasks', () => {
  test('empty list initially', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('lists all tasks', async () => {
    await createTask({ title: 'a' });
    await createTask({ title: 'b' });
    const res = await request(app).get('/tasks');
    expect(res.body).toHaveLength(2);
  });

  test('filters by status', async () => {
    await createTask({ title: 'a', status: 'todo' });
    await createTask({ title: 'b', status: 'done' });
    const res = await request(app).get('/tasks?status=done');
    expect(res.body.map((t) => t.title)).toEqual(['b']);
  });

  test('[BUG] a partial status like ?status=do does not match anything', async () => {
    await createTask({ title: 'a', status: 'todo' });
    await createTask({ title: 'b', status: 'done' });
    const res = await request(app).get('/tasks?status=do');
    expect(res.body).toEqual([]);
  });

  describe('pagination', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 15; i++) await createTask({ title: `task ${i}` });
    });

    test('[BUG] ?page=1&limit=10 returns the first 10 tasks', async () => {
      const res = await request(app).get('/tasks?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(10);
      expect(res.body[0].title).toBe('task 1');
    });

    test('page 2 returns the remainder', async () => {
      const res = await request(app).get('/tasks?page=2&limit=10');
      expect(res.body.map((t) => t.title)).toEqual(['task 11', 'task 12', 'task 13', 'task 14', 'task 15']);
    });

    test('limit defaults to 10 and page defaults to 1', async () => {
      const res = await request(app).get('/tasks?page=1');
      expect(res.body).toHaveLength(10);
      const res2 = await request(app).get('/tasks?limit=4');
      expect(res2.body.map((t) => t.title)).toEqual(['task 1', 'task 2', 'task 3', 'task 4']);
    });

    test('[BUG] invalid page/limit values are rejected with 400', async () => {
      for (const q of ['page=0', 'page=-1', 'limit=0', 'limit=-5', 'page=abc', 'limit=1.5']) {
        const res = await request(app).get(`/tasks?${q}`);
        expect(res.status).toBe(400);
      }
    });

    test('limit is capped at 100', async () => {
      const res = await request(app).get('/tasks?page=1&limit=100000');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(15);
    });

    test('[BUG] status filter and pagination work together', async () => {
      service._reset();
      for (let i = 1; i <= 6; i++) await createTask({ title: `d${i}`, status: 'done' });
      for (let i = 1; i <= 6; i++) await createTask({ title: `t${i}`, status: 'todo' });
      const res = await request(app).get('/tasks?status=done&page=1&limit=4');
      expect(res.body.map((t) => t.title)).toEqual(['d1', 'd2', 'd3', 'd4']);
    });
  });
});

describe('PUT /tasks/:id', () => {
  test('updates the task', async () => {
    const { body: t } = await createTask({ title: 'old' });
    const res = await request(app).put(`/tasks/${t.id}`).send({ title: 'new', status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, title: 'new', status: 'in_progress' });
  });

  test('404 for an unknown id', async () => {
    const res = await request(app).put('/tasks/does-not-exist').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  test('400 for invalid data and the task is left unchanged', async () => {
    const { body: t } = await createTask({ title: 'keep' });
    const res = await request(app).put(`/tasks/${t.id}`).send({ title: '' });
    expect(res.status).toBe(400);
    expect(service.findById(t.id).title).toBe('keep');
  });

  test('[BUG] cannot overwrite id / createdAt / completedAt through the body', async () => {
    const { body: t } = await createTask({ title: 'a' });
    const res = await request(app)
      .put(`/tasks/${t.id}`)
      .send({ id: 'evil', createdAt: '2000-01-01T00:00:00.000Z', completedAt: '2000-01-01T00:00:00.000Z' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(t.id);
    expect(res.body.createdAt).toBe(t.createdAt);
    expect(res.body.completedAt).toBeNull();
  });
});

describe('PUT status transitions (HTTP)', () => {
  test('[BUG] PUT status=done sets completedAt; PUT back to todo clears it', async () => {
    const { body: t } = await createTask();
    const done = await request(app).put(`/tasks/${t.id}`).send({ status: 'done' });
    expect(done.body.completedAt).not.toBeNull();
    const back = await request(app).put(`/tasks/${t.id}`).send({ status: 'todo' });
    expect(back.body.completedAt).toBeNull();
  });
});

describe('DELETE /tasks/:id', () => {
  test('204 and the task is gone', async () => {
    const { body: t } = await createTask();
    const res = await request(app).delete(`/tasks/${t.id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect((await request(app).get('/tasks')).body).toHaveLength(0);
  });

  test('404 for an unknown id, and a second delete is also 404', async () => {
    const { body: t } = await createTask();
    await request(app).delete(`/tasks/${t.id}`);
    expect((await request(app).delete(`/tasks/${t.id}`)).status).toBe(404);
    expect((await request(app).delete('/tasks/nope')).status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('marks the task done with completedAt', async () => {
    const { body: t } = await createTask();
    const res = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  test('[BUG] does not change the priority', async () => {
    const { body: t } = await createTask({ title: 'urgent', priority: 'high' });
    const res = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(res.body.priority).toBe('high');
  });

  test('404 for an unknown id', async () => {
    expect((await request(app).patch('/tasks/nope/complete')).status).toBe(404);
  });
});

describe('GET /tasks/stats', () => {
  test('returns counts by status plus overdue', async () => {
    await createTask({ title: 'a' });
    await createTask({ title: 'b', status: 'in_progress', dueDate: iso(-3) });
    await createTask({ title: 'c', status: 'done', dueDate: iso(-3) });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 1, done: 1, overdue: 1 });
  });

  test('is not shadowed by the /:id routes', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.body).toHaveProperty('overdue');
  });
});

describe('PATCH /tasks/:id/assign', () => {
  test('assigns and returns the updated task', async () => {
    const { body: t } = await createTask();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Asha' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, assignee: 'Asha' });
    // persisted, not just echoed
    expect(service.findById(t.id).assignee).toBe('Asha');
  });

  test('trims surrounding whitespace', async () => {
    const { body: t } = await createTask();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: '  Asha  ' });
    expect(res.body.assignee).toBe('Asha');
  });

  test('404 when the task does not exist', async () => {
    const res = await request(app).patch('/tasks/nope/assign').send({ assignee: 'Asha' });
    expect(res.status).toBe(404);
  });

  test.each([
    ['empty string', { assignee: '' }],
    ['whitespace only', { assignee: '   ' }],
    ['missing field', {}],
    ['non-string', { assignee: 42 }],
    ['too long', { assignee: 'x'.repeat(101) }],
  ])('400 for %s, and the task stays unassigned', async (_n, body) => {
    const { body: t } = await createTask();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/assignee/);
    expect(service.findById(t.id).assignee).toBeNull();
  });

  test('re-assigning an already-assigned task is allowed and replaces the assignee', async () => {
    const { body: t } = await createTask();
    await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Asha' });
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Ravi' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Ravi');
  });

  test('assigning does not change the task status', async () => {
    const { body: t } = await createTask({ title: 'a', status: 'in_progress' });
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Asha' });
    expect(res.body.status).toBe('in_progress');
  });

  test('assigned task shows up in GET /tasks', async () => {
    const { body: t } = await createTask();
    await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Asha' });
    const list = (await request(app).get('/tasks')).body;
    expect(list[0].assignee).toBe('Asha');
  });
});

describe('unknown routes', () => {
  test('return a JSON 404', async () => {
    const res = await request(app).get('/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});

describe('error handling', () => {
  test('oversized body is reported as a 4xx (not a 500)', async () => {
    const res = await request(app).post('/tasks').send({ title: 'x', description: 'a'.repeat(200 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body.error).toBeDefined();
  });
});
