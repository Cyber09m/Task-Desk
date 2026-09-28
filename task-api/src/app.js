const path = require('path');
const express = require('express');
const taskRoutes = require('./routes/tasks');

const app = express();

app.use(express.json());

// Tiny health endpoint for hosting platforms (Render, Railway, ...).
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Bonus: serve the web UI (public/index.html) from the same server, so the
// whole project deploys as a single service with a single live URL.
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/tasks', taskRoutes);

// Unknown routes -> JSON 404 (Express' default is an HTML page).
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Central error handler.
// FIX for BUG #4: body-parser errors (e.g. malformed JSON) carry err.status 400,
// but the original handler turned every error into a 500.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Task API running on port ${PORT}`);
  });
}

module.exports = app;
