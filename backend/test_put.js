const http = require('http');

const data = JSON.stringify({
  title: 'SEGUNDA QUINCENA JUNIO 2026',
  companies: ['ECONACIONAL,S.A.'],
  periodType: '2da',
  createdAt: new Date().toISOString()
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/payroll-drafts/1780511113297',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', console.error);
req.write(data);
req.end();
