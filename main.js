import fs from 'node:fs/promises';
import http from 'node:http';
import { once } from 'node:events';
import { Command } from 'commander';

const program = new Command();

program
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера')
  .requiredOption('-c, --cache <path>', 'тека для кешованих картинок')
  .helpOption('--help', 'показати довідку');

program.parse();
const options = program.opts();

try {
  await fs.mkdir(options.cache, { recursive: true });
} catch {
  console.error(`Не вдалося створити теку кешу: ${options.cache}`);
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Проксі-сервер працює');
});

try {
  server.listen(options.port, options.host);
  await once(server, 'listening');
  console.log(`Сервер запущено: http://${options.host}:${options.port}`);
} catch (error) {
  console.error(`Не вдалося запустити сервер: ${error.message}`);
  process.exit(1);
}