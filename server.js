const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);

  // Normalize URL path and resolve file path
  let safeUrl = req.url.split('?')[0]; // strip query params
  if (safeUrl === '/') {
    safeUrl = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, safeUrl);

  // Check if file is inside public directory (prevent directory traversal)
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Security Intrusion Detected');
    console.warn(`[WARNING] Directory traversal attempt blocked: ${req.url}`);
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: File Missing from Crypt-Array');
      console.log(`[404] File not found: ${filePath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    
    const stream = fs.createReadStream(filePath);
    stream.on('error', (streamErr) => {
      console.error(`[ERROR] Stream failed for ${filePath}:`, streamErr);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error: Crypt-Array Defect');
      }
    });
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  ISA (Intelligence Security Agency) SECURE MAINFRAME`);
  console.log(`=======================================================`);
  console.log(`  [STATUS] Online & Guarded by Cyber-Shield`);
  console.log(`  [URL] http://localhost:${PORT}`);
  console.log(`  [INFO] Press Ctrl+C to terminate connection`);
  console.log(`=======================================================`);
});
