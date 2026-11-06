import http from 'node:http';
import { handler } from './index.mjs';

const port = Number(process.env.PORT || 8080);
const maxBody = 8 * 1024 * 1024;

const server = http.createServer(async (req, res) => {
  if (req.url === '/health/live' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ status: 'live' }));
  }
  if (req.url !== '/api/' && req.url !== '/api') {
    res.writeHead(404);
    return res.end();
  }
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    res.writeHead(405, { Allow: 'POST, OPTIONS' });
    return res.end();
  }
  let raw = '';
  try {
    for await (const chunk of req) {
      raw += chunk.toString('utf8');
      if (Buffer.byteLength(raw) > maxBody) {
        res.writeHead(413);
        return res.end();
      }
    }
    const result = await handler({
      httpMethod: req.method,
      headers: req.headers,
      body: raw,
      isBase64Encoded: false,
    });
    res.writeHead(result.statusCode || 200, result.headers || {});
    res.end(result.body || '');
  } catch (error) {
    console.error('[http] request failed', error);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Błąd serwera' }));
  }
});

server.listen(port, '0.0.0.0', () => console.log(`CommandFIRE CRM API listening on ${port}`));
