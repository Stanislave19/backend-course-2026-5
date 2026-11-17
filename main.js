import fs from 'node:fs/promises';
import http from 'node:http';
import { once } from 'node:events';
import { buffer } from 'node:stream/consumers';
import { Command } from 'commander';
import superagent from 'superagent';

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

function sendText(res, status, message) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function sendImage(res, image, source) {
  res.writeHead(200, { 'Content-Type': 'image/jpeg', 'X-Cache': source });
  res.end(image);
}

async function handleGet(res, code, filePath) {
  try {
    const image = await fs.readFile(filePath);
    sendImage(res, image, 'HIT');
    return;
  } catch {
    // картинки немає в кеші — отримуємо її з http.cat
  }

  let image;
  try {
    const response = await superagent.get(`https://http.cat/${code}`);
    image = response.body;
  } catch {
    sendText(res, 404, `Картинку для коду ${code} не знайдено`);
    return;
  }

  await fs.writeFile(filePath, image);
  sendImage(res, image, 'MISS');
}

async function handlePut(req, res, filePath) {
  const image = await buffer(req);

  if (image.length === 0) {
    sendText(res, 400, 'Тіло запиту порожнє: надішліть картинку');
    return;
  }

  await fs.writeFile(filePath, image);
  sendText(res, 201, 'Картинку збережено в кеш');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const code = url.pathname.slice(1);

    if (!/^\d{3}$/.test(code)) {
      sendText(res, 400, 'Шлях має бути тризначним кодом стану, наприклад /200');
      return;
    }

    const filePath = `${options.cache}/${code}.jpg`;

    if (req.method === 'GET') {
      await handleGet(res, code, filePath);
      return;
    }

    if (req.method === 'PUT') {
      await handlePut(req, res, filePath);
      return;
    }

    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, PUT' });
    res.end('Метод не дозволено');
  } catch {
    sendText(res, 500, 'Внутрішня помилка сервера');
  }
});

try {
  server.listen(options.port, options.host);
  await once(server, 'listening');
  console.log(`Сервер запущено: http://${options.host}:${options.port}`);
} catch (error) {
  console.error(`Не вдалося запустити сервер: ${error.message}`);
  process.exit(1);
}