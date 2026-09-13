import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { apiRouter } from '../server/routes.js';

test('GET /api/health returns 200 and status ok', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.equal(data.service, 'AegisAI');
  } finally {
    server.close();
  }
});
