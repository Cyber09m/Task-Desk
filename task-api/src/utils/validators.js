/**
 * Input validation helpers.
 * Every validator returns `null` when the input is valid, or a human-readable
 * error string when it is not (the routes turn that into a 400 response).
 */
const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

// Pagination limits (NOTE: chosen defensively so one request can't dump the whole store).
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

// Longest assignee name we accept. Arbitrary but generous; stops abuse / UI breakage.
const MAX_ASSIGNEE_LENGTH = 100;

const validateCreateTask = (body) => {
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return 'title is required and must be a non-empty string';
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.dueDate && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }
  return null;
};

const validateUpdateTask = (body) => {
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim() === '')) {
    return 'title must be a non-empty string';
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.dueDate && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }
  return null;
};

/**
 * PATCH /tasks/:id/assign  body: { assignee: string }
 * Design decision: reject empty / whitespace-only / non-string names rather than
 * treating them as "unassign" - un-assigning is a different intent and should be
 * an explicit operation (e.g. DELETE /tasks/:id/assign) if we ever need it.
 */
const validateAssignTask = (body) => {
  const { assignee } = body || {};
  if (typeof assignee !== 'string' || assignee.trim() === '') {
    return 'assignee is required and must be a non-empty string';
  }
  if (assignee.trim().length > MAX_ASSIGNEE_LENGTH) {
    return `assignee must be at most ${MAX_ASSIGNEE_LENGTH} characters`;
  }
  return null;
};

/**
 * Parses ?page= and ?limit= from a query object.
 * Returns { page, limit } on success or { error } on failure.
 * Only positive whole numbers are accepted; limit is capped at MAX_LIMIT.
 */
const validatePagination = (query) => {
  const parse = (raw, name, fallback) => {
    if (raw === undefined) return { value: fallback };
    if (!/^\d+$/.test(String(raw)) || Number(raw) < 1) {
      return { error: `${name} must be a positive integer` };
    }
    return { value: Number(raw) };
  };

  const page = parse(query.page, 'page', DEFAULT_PAGE);
  if (page.error) return { error: page.error };
  const limit = parse(query.limit, 'limit', DEFAULT_LIMIT);
  if (limit.error) return { error: limit.error };

  return { page: page.value, limit: Math.min(limit.value, MAX_LIMIT) };
};

module.exports = {
  VALID_STATUSES,
  VALID_PRIORITIES,
  validateCreateTask,
  validateUpdateTask,
  validateAssignTask,
  validatePagination,
};
