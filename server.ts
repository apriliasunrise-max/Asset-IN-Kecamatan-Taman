import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createApiRouter } from './src/server/routes.ts';

async function startServer(): Promise<void> {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use('/api', createApiRouter());

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`ASSET-IN server running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ASSET-IN server:', err);
  process.exit(1);
});
