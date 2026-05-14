import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Custom plugin: load .md scripts as raw text with HMR support
function rawMarkdownPlugin() {
  return {
    name: 'raw-markdown',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (id.endsWith('.md?raw')) {
        return null;
      }
      return null;
    },
    handleHotUpdate(ctx: { file: string; server: { ws: { send: (payload: unknown) => void } } }) {
      if (ctx.file.endsWith('.md')) {
        ctx.server.ws.send({ type: 'custom', event: 'script-changed', data: { path: ctx.file } });
      }
    },
  };
}

// Dev-only plugin: expose POST /dev/patch-text to overwrite text in a script file.
// Only active during `vite dev`; not included in production builds.
function patchTextPlugin() {
  return {
    name: 'patch-text',
    apply: 'serve' as const,
    configureServer(server: {
      middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void };
      config: { root: string };
    }) {
      server.middlewares.use('/dev/patch-text', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const { filePath, from, to } = JSON.parse(body) as { filePath: string; from: string; to: string };
            const absolutePath = path.join(server.config.root, filePath);
            // Normalize CRLF → LF so rawMarkdown (always LF) matches file content
            let content = await fs.promises.readFile(absolutePath, 'utf8');
            content = content.replace(/\r\n/g, '\n');
            if (!content.includes(from)) {
              res.statusCode = 422;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Text not found in file' }));
              return;
            }
            // Replace first occurrence only
            const updated = content.replace(from, to);
            await fs.promises.writeFile(absolutePath, updated, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), rawMarkdownPlugin(), patchTextPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@scripts': path.resolve(__dirname, 'scripts'),
      '@assets': path.resolve(__dirname, 'public/assets'),
    },
  },
  server: {
    port: 4519,
    strictPort: true,
    host: true,
    fs: {
      // allow serving files from one level up so we can access the original scripts via symlink/copy
      allow: ['..'],
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
