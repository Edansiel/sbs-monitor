const express      = require('express');
const path         = require('path');
const fs           = require('fs');
const { chromium } = require('playwright');
const axios        = require('axios');

const app  = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io   = new Server(http);             // 🔌 WebSocket server

const PORT         = process.env.PORT || 3000;
const URL          = 'https://www.sbs.gob.pe/app/pp/sistip_portal/paginas/publicacion/tipocambiopromedio.aspx';
const STORAGE_FILE = path.join(__dirname, 'storage.json');
const LOG_FILE     = path.join(__dirname, 'logs.json');
const WEBHOOK_N8N  = 'https://jeancarlovidela.app.n8n.cloud/webhook/8f405f9f-2fc3-459b-9b04-bd190c5fe17c';

const EVERY_MINUTE = 60_000;
const DAYS_TO_KEEP = 3;
const MS_IN_DAY    = 24 * 60 * 60 * 1000;

// 👉  carpeta “public/” con index.html, css, etc.
app.use(express.static(path.join(__dirname, 'public')));

// API REST para que el front pueda pedir los logs
app.get('/logs', (_, res) => {
  let history = [];
  if (fs.existsSync(LOG_FILE)) {
    try { history = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')); } catch {}
  }
  res.json(history);
});

// Evento cuando alguien abre el dashboard
io.on('connection', socket => {
  console.log('📡 Cliente conectado:', socket.id);
});

// -----------------------------------------------------------------------------
// Función que comprueba la SBS y, si corresponde, envía webhook
// -----------------------------------------------------------------------------
async function checkAndSend() {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  await page.setExtraHTTPHeaders({
    'User-Agent'     : 'Mozilla/5.0',
    'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-PE,es;q=0.9'
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('#ctl00_cphContent_lblFecha', { timeout: 60_000 });

  const texto    = await page.textContent('#ctl00_cphContent_lblFecha');
  const fechaSBS = (texto || '').match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
  await browser.close();

  if (!fechaSBS) {
    console.error('❌ No se pudo leer la fecha de la SBS');
    return;
  }

  const hoyLima = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima', day:'2-digit', month:'2-digit', year:'numeric'
  }).format(new Date());

  let ultima = null;
  if (fs.existsSync(STORAGE_FILE)) {
    try { ultima = JSON.parse(fs.readFileSync(STORAGE_FILE)).fecha; } catch {}
  }

  const esHoy    = fechaSBS === hoyLima;
  const yaEnviada= ultima    === hoyLima;

  // ---------------- Envío del webhook ----------------
  if (esHoy && !yaEnviada) {
    console.log('🚀 Webhook enviado –', fechaSBS);
    await axios.post(WEBHOOK_N8N, { fecha: fechaSBS });
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({ fecha: fechaSBS }));
  } else {
    console.log('⏸️ Nada que enviar. FechaSBS:', fechaSBS, '| Hoy:', hoyLima);
  }

  // ---------------- Registro de log ------------------
  const entrada = {
    timestamp : new Date().toISOString(),
    fechaSBS,
    enviado   : esHoy && !yaEnviada
  };

  let history = [];
  if (fs.existsSync(LOG_FILE)) {
    try { history = JSON.parse(fs.readFileSync(LOG_FILE)); } catch {}
  }

  const ahora = Date.now();
  history = history.filter(e =>
    ahora - new Date(e.timestamp).getTime() <= DAYS_TO_KEEP * MS_IN_DAY
  );
  history.push(entrada);
  fs.writeFileSync(LOG_FILE, JSON.stringify(history, null, 2));

  // 🔔 Aviso al dashboard para que se refresque
  io.emit('updateLogs');
}

// Primera ejecución + cron cada minuto
checkAndSend().catch(console.error);
setInterval(() => checkAndSend().catch(console.error), EVERY_MINUTE);

// -----------------------------------------------------------------
http.listen(PORT, () => console.log(`🔌 Servidor en http://localhost:${PORT}`));
