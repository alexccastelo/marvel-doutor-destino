const http = require('http');
const fs = require('fs');
const path = require('path');

// Variáveis do banco (DATABASE_URL) vindas de "vercel env pull .env.local --yes"
try {
  process.loadEnvFile(path.join(__dirname, '.env.local'));
} catch {
  console.warn('Aviso: .env.local não encontrado; usando variáveis do ambiente.');
}

const moviesHandler = require('./api/movies');
const authHandler = require('./api/auth');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // Espelha os rewrites do vercel.json: /doomsday/* é servido a partir da raiz
  if (pathname === '/doomsday' || pathname === '/doomsday/') {
    pathname = '/';
  } else if (pathname.startsWith('/doomsday/')) {
    pathname = pathname.slice('/doomsday'.length);
  }

  // Rotas de API
  const isMoviesApi = pathname === '/api/movies' || pathname.startsWith('/api/movies/');
  const isAuthApi = pathname === '/api/auth' || pathname.startsWith('/api/auth/');

  if (isMoviesApi || isAuthApi) {
    const handler = isMoviesApi ? moviesHandler : authHandler;

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          req.body = body ? JSON.parse(body) : {};
        } catch (e) {
          req.body = {};
        }
        await executeHandler(handler, req, res);
      });
      return;
    } else {
      req.body = {};
      await executeHandler(handler, req, res);
      return;
    }
  }

  // Servir arquivos estáticos da pasta public/
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Evitar directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Acesso proibido');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallbackPath = path.join(PUBLIC_DIR, `${pathname}.html`);
      fs.stat(fallbackPath, (fallbackErr, fallbackStats) => {
        if (!fallbackErr && fallbackStats.isFile()) {
          serveFile(fallbackPath, res);
        } else {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
          res.end('404 - Não encontrado');
        }
      });
      return;
    }

    serveFile(filePath, res);
  });
});

async function executeHandler(handler, req, res) {
  // Mock dos métodos res.status e res.json para compatibilidade Vercel Serverless
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.json = function (data) {
    res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    res.end(JSON.stringify(data));
    return res;
  };

  try {
    await handler(req, res);
  } catch (err) {
    console.error('Erro no handler:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Erro interno no servidor.' }));
  }
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 Servidor Marvel Doomsday rodando em: http://localhost:${PORT}`);
  console.log(`💾 Banco de dados: ${process.env.DATABASE_URL ? 'Postgres (Neon)' : 'DATABASE_URL ausente!'}`);
  console.log(`👤 Endpoints: /api/auth e /api/movies`);
  console.log(`==================================================\n`);
});
