const express = require('express');
const router = express.Router();
const taskService = require('../services/taskService');
const {
  validateCreateTask,
  validateUpdateTask,
  validateAssignTask,
  validatePagination,
} = require('../utils/validators');

// NOTE: /stats must be registered before any "/:id" route or Express would
// treat the word "stats" as an id.
router.get('/stats', (req, res) => {
  const stats = taskService.getStats();
  res.json(stats);
});

router.get('/', (req, res) => {
  const { status, page, limit } = req.query;

  // Pagination is only applied when the client asks for it (keeps the original
  // "no params = everything" behaviour).
  if (page !== undefined || limit !== undefined) {
    const parsed = validatePagination(req.query);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }
    // FIX for BUG #6: status + pagination are now combined instead of the
    // status filter silently ignoring page/limit.
    return res.json(taskService.getPaginated(parsed.page, parsed.limit, status || undefined));
  }

  if (status) {
    return res.json(taskService.getByStatus(status));
  }

  res.json(taskService.getAll());
});

router.post('/', (req, res) => {
  const error = validateCreateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.create(req.body);
  res.status(201).json(task);
});

router.put('/:id', (req, res) => {
  const error = validateUpdateTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.update(req.params.id, req.body);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

router.delete('/:id', (req, res) => {
  const deleted = taskService.remove(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.status(204).send();
});

router.patch('/:id/complete', (req, res) => {
  const task = taskService.completeTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

// NEW FEATURE: PATCH /tasks/:id/assign  { "assignee": "Asha" }
// Validation runs first (same convention as PUT), then 404 for unknown ids.
router.patch('/:id/assign', (req, res) => {
  const error = validateAssignTask(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const task = taskService.assignTask(req.params.id, req.body.assignee);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

module.exports = router;
