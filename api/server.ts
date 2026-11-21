import 'dotenv/config';
import { createApiApp } from '../server/createApp.js';

export const maxDuration = 60;
export const config = {
  api: {
    bodyParser: false,
  },
};

const app = createApiApp();

// Unknown API endpoints return JSON 404
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

export default app;
