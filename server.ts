import 'dotenv/config';
import express from 'express';
import path from 'path';
import { apiRouter } from './server/routes.js';

const app = express();
const port = 3000;

app.use(express.json());

// JSON syntax error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload', code: 'BAD_REQUEST' });
  }
  next(err);
});

app.use('/api', apiRouter);

// In production, serve static assets built by Vite
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`AegisAI production server running on port ${port}`);
});
