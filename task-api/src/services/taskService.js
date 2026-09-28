/**
 * Task business logic + in-memory data store.
 * NOTE: data lives in a plain array, so it resets on every server restart.
 */
const { v4: uuidv4 } = require('uuid');

let tasks = [];

// Fields a client may change through PUT. Everything else (id, createdAt,
// completedAt, assignee) is server-managed. FIX for BUG #5 (mass assignment).
const UPDATABLE_FIELDS = ['title', 'description', 'status', 'priority', 'dueDate'];

const getAll = () => [...tasks];

const findById = (id) => tasks.find((t) => t.id === id);

// FIX for BUG #2: was `t.status.includes(status)` (substring match, so "do"
// matched both "todo" and "done"). Now an exact comparison.
const getByStatus = (status) => tasks.filter((t) => t.status === status);

// FIX for BUG #1 + #6: pages are 1-indexed (offset = (page - 1) * limit; the
// original used page * limit and skipped the first page). Optional `status`
// lets pagination work together with the status filter.
const getPaginated = (page, limit, status) => {
  const source = status ? getByStatus(status) : tasks;
  const offset = (page - 1) * limit;
  return source.slice(offset, offset + limit);
};

const getStats = () => {
  const now = new Date();
  const counts = { todo: 0, in_progress: 0, done: 0 };
  let overdue = 0;

  tasks.forEach((t) => {
    if (counts[t.status] !== undefined) counts[t.status]++;
    if (t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now) {
      overdue++;
    }
  });

  return { ...counts, overdue };
};

const create = ({ title, description = '', status = 'todo', priority = 'medium', dueDate = null }) => {
  const task = {
    id: uuidv4(),
    title,
    description,
    status,
    priority,
    dueDate,
    completedAt: null,
    assignee: null, // set via PATCH /tasks/:id/assign
    createdAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
};

const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  // Only copy whitelisted fields so clients can't overwrite id/createdAt/etc.
  const allowed = {};
  UPDATABLE_FIELDS.forEach((key) => {
    if (fields[key] !== undefined) allowed[key] = fields[key];
  });

  const updated = { ...tasks[index], ...allowed };

  // FIX for BUG #7: keep completedAt consistent with status. Moving a task to
  // "done" via PUT stamps it (once); moving it back out of "done" clears it.
  if (allowed.status !== undefined && allowed.status !== tasks[index].status) {
    updated.completedAt = allowed.status === 'done' ? new Date().toISOString() : null;
  }

  tasks[index] = updated;
  return updated;
};

const remove = (id) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;

  tasks.splice(index, 1);
  return true;
};

const completeTask = (id) => {
  const task = findById(id);
  if (!task) return null;

  // FIX for BUG #8: completing twice must not overwrite the original completedAt.
  if (task.status === 'done') return task;

  // FIX for BUG #3: the original also forced `priority: 'medium'` here, silently
  // destroying the user's priority. Completing a task only changes status/completedAt.
  const updated = {
    ...task,
    status: 'done',
    completedAt: new Date().toISOString(),
  };

  const index = tasks.findIndex((t) => t.id === id);
  tasks[index] = updated;
  return updated;
};

/**
 * Assign a task to a person. Returns the updated task, or null if not found.
 * Re-assigning simply replaces the previous assignee (see README design notes).
 */
const assignTask = (id, assignee) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated = { ...tasks[index], assignee: assignee.trim() };
  tasks[index] = updated;
  return updated;
};

const _reset = () => {
  tasks = [];
};

module.exports = {
  getAll,
  findById,
  getByStatus,
  getPaginated,
  getStats,
  create,
  update,
  remove,
  completeTask,
  assignTask,
  _reset,
};
