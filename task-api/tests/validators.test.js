/** Unit tests for src/utils/validators.js */
const {
  validateCreateTask,
  validateUpdateTask,
  validateAssignTask,
  validatePagination,
} = require('../src/utils/validators');

describe('validateCreateTask', () => {
  test('accepts a minimal valid body', () => {
    expect(validateCreateTask({ title: 'ok' })).toBeNull();
  });

  test.each([
    ['missing title', {}],
    ['empty title', { title: '' }],
    ['whitespace title', { title: '   ' }],
    ['non-string title', { title: 42 }],
  ])('rejects %s', (_n, body) => {
    expect(validateCreateTask(body)).toMatch(/title/);
  });

  test('rejects bad status / priority / dueDate', () => {
    expect(validateCreateTask({ title: 'a', status: 'pending' })).toMatch(/status/);
    expect(validateCreateTask({ title: 'a', priority: 'urgent' })).toMatch(/priority/);
    expect(validateCreateTask({ title: 'a', dueDate: 'not-a-date' })).toMatch(/dueDate/);
  });

  test('accepts a valid ISO dueDate', () => {
    expect(validateCreateTask({ title: 'a', dueDate: '2030-01-01T00:00:00.000Z' })).toBeNull();
  });
});

describe('validateUpdateTask', () => {
  test('accepts an empty body (nothing to change)', () => {
    expect(validateUpdateTask({})).toBeNull();
  });

  test('rejects an empty / non-string title when title is supplied', () => {
    expect(validateUpdateTask({ title: '' })).toMatch(/title/);
    expect(validateUpdateTask({ title: 5 })).toMatch(/title/);
  });

  test('rejects bad status / priority / dueDate', () => {
    expect(validateUpdateTask({ status: 'nope' })).toMatch(/status/);
    expect(validateUpdateTask({ priority: 'nope' })).toMatch(/priority/);
    expect(validateUpdateTask({ dueDate: 'nope' })).toMatch(/dueDate/);
  });
});

describe('validateAssignTask', () => {
  test('accepts a normal name', () => {
    expect(validateAssignTask({ assignee: 'Asha' })).toBeNull();
  });

  test.each([
    ['missing', {}],
    ['empty string', { assignee: '' }],
    ['whitespace only', { assignee: '   ' }],
    ['a number', { assignee: 7 }],
    ['null', { assignee: null }],
    ['an object', { assignee: { name: 'x' } }],
    ['over 100 chars', { assignee: 'a'.repeat(101) }],
  ])('rejects assignee that is %s', (_n, body) => {
    expect(validateAssignTask(body)).toMatch(/assignee/);
  });

  test('accepts exactly 100 chars', () => {
    expect(validateAssignTask({ assignee: 'a'.repeat(100) })).toBeNull();
  });
});

describe('validatePagination', () => {
  test('defaults when nothing supplied', () => {
    expect(validatePagination({})).toEqual({ page: 1, limit: 10 });
  });

  test('parses numeric strings', () => {
    expect(validatePagination({ page: '2', limit: '5' })).toEqual({ page: 2, limit: 5 });
  });

  test('caps limit at 100', () => {
    expect(validatePagination({ limit: '5000' }).limit).toBe(100);
  });

  test.each([['0'], ['-1'], ['abc'], ['1.5'], ['']])('rejects page=%p', (p) => {
    expect(validatePagination({ page: p }).error).toMatch(/page/);
  });

  test.each([['0'], ['-3'], ['xyz']])('rejects limit=%p', (l) => {
    expect(validatePagination({ limit: l }).error).toMatch(/limit/);
  });
});
