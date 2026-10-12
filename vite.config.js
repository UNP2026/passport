import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function apiMiddleware() {
  return {
    name: 'api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();

        try {
          const urlPath = req.url.split('?')[0];
          let filePath = path.resolve(__dirname, '.' + urlPath + '.ts');
          if (!fs.existsSync(filePath)) {
            filePath = path.resolve(__dirname, '.' + urlPath + '.js');
          }
          if (!fs.existsSync(filePath)) {
            return next();
          }

          let body = '';
          req.on('data', chunk => { body += chunk; });
          await new Promise(resolve => req.on('end', resolve));
          if (body) {
            try {
              req.body = JSON.parse(body);
            } catch {
              req.body = body;
            }
          } else {
            req.body = {};
          }

          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          };

          const module = await server.ssrLoadModule(filePath);
          if (module && typeof module.default === 'function') {
            await module.default(req, res);
          } else {
            next();
          }
        } catch (err) {
          console.error('API Error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
          }
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), apiMiddleware()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
