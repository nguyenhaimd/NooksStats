import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Proxy endpoint to bypass adblockers
  app.all('/api/proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
      // Forward all headers except host and connection
      const fetchHeaders: Record<string, string> = {};
      
      if (req.headers.authorization) fetchHeaders.authorization = req.headers.authorization;
      if (req.headers['content-type']) fetchHeaders['content-type'] = req.headers['content-type'];
      
      const fetchOptions: RequestInit = {
        method: req.method,
        headers: fetchHeaders,
      };

      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
         if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
            const body = new URLSearchParams();
            for (const key in req.body) {
                body.append(key, req.body[key]);
            }
            fetchOptions.body = body.toString();
         } else {
            fetchOptions.body = JSON.stringify(req.body);
         }
      }

      const response = await fetch(targetUrl, fetchOptions);
      const text = await response.text();
      
      // Try to parse as JSON if it is JSON
      try {
        const json = JSON.parse(text);
        res.status(response.status).json(json);
      } catch (e) {
        res.status(response.status).send(text);
      }
    } catch (error: any) {
      console.error('Proxy error:', error);
      res.status(500).json({ error: 'Proxy Request Failed', details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // In Express v5, use '*all'
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
