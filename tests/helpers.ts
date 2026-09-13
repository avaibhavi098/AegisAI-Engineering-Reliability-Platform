import express, { Express } from 'express';
import { Server } from 'http';

process.env.NODE_ENV = 'test';

import { apiRouter } from '../server/routes.js';
import { db } from '../server/db.js';

export interface TestClient {
  server: Server;
  baseUrl: string;
  close: () => Promise<void>;
  request: (
    path: string,
    options?: {
      method?: string;
      body?: any;
      token?: string;
      headers?: Record<string, string>;
    }
  ) => Promise<{ status: number; body: any; headers: Headers }>;
  getAdminToken: () => Promise<string>;
  getEngineerToken: () => Promise<string>;
  getViewerToken: () => Promise<string>;
}

export async function createTestClient(): Promise<TestClient> {
  const app: Express = express();
  app.use(express.json());

  // JSON syntax error handling middleware
  app.use((err: any, _req: any, res: any, next: any) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Malformed JSON payload', code: 'BAD_REQUEST' });
    }
    next(err);
  });

  app.use('/api', apiRouter);

  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const request = async (
    path: string,
    options?: {
      method?: string;
      body?: any;
      token?: string;
      headers?: Record<string, string>;
    }
  ) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (options?.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method: options?.method || 'GET',
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    let body: any = null;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    return {
      status: res.status,
      body,
      headers: res.headers,
    };
  };

  const getAdminToken = async (): Promise<string> => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@aegis.internal', password: 'AegisSec2026!' },
    });
    if (res.status === 200 && res.body?.token) {
      return res.body.token;
    }
    const email = `test-admin-${Date.now()}@aegis.internal`;
    const signup = await request('/auth/signup', {
      method: 'POST',
      body: {
        name: 'Test Admin',
        email,
        password: 'AegisSec2026!',
        role: 'ADMIN',
      },
    });
    return signup.body.token;
  };

  const getEngineerToken = async (): Promise<string> => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: { email: 'engineer@aegis.internal', password: 'AegisSec2026!' },
    });
    if (res.status === 200 && res.body?.token) {
      return res.body.token;
    }
    const email = `test-eng-${Date.now()}@aegis.internal`;
    const signup = await request('/auth/signup', {
      method: 'POST',
      body: {
        name: 'Test Engineer',
        email,
        password: 'AegisSec2026!',
        role: 'ENGINEER',
      },
    });
    return signup.body.token;
  };

  const getViewerToken = async (): Promise<string> => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: { email: 'viewer@aegis.internal', password: 'AegisSec2026!' },
    });
    if (res.status === 200 && res.body?.token) {
      return res.body.token;
    }
    const email = `test-viewer-${Date.now()}@aegis.internal`;
    const signup = await request('/auth/signup', {
      method: 'POST',
      body: {
        name: 'Test Viewer',
        email,
        password: 'AegisSec2026!',
        role: 'VIEWER',
      },
    });
    return signup.body.token;
  };

  const close = async () => {
    if (typeof (server as any).closeAllConnections === 'function') {
      (server as any).closeAllConnections();
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return {
    server,
    baseUrl,
    close,
    request,
    getAdminToken,
    getEngineerToken,
    getViewerToken,
  };
}
