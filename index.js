const express      = require('express');
const path         = require('path');
const fs           = require('fs');
const { chromium } = require('playwright');
const axios        = require('axios');

const app          = express();
const PORT         = process.env.PORT || 3000;

const URL          = 'https://www.sbs.gob.pe/app/pp/sistip_portal/paginas/publicacion/tipocambiopromedio.aspx';
const STORAGE_FILE = path.join(__dirname, 'storage.json');
const LOG_FILE     = path.join(__dirname, 'logs.json');
const WEBHOOK_N8N  = 'https://jeancarlovidela.app.n8n.cloud/webhook/8f405f9f-2fc3-459b-9b04-bd190c5fe17c';

const EVERY_MINUTE = 60_000;
const DAYS_TO_KEEP = 5;
const MS_IN_DAY    = 24 * 60 * 60 * 1000;

// 1️⃣ Sirve todo lo que esté en /public
app.use(express.static(path.join(__dirname, 'public')));

// 2️⃣ Endpoint para los logs en JSON
app.get('/logs', (_, res) => {
  let history = [];
  if (fs.existsSync(LOG_FILE)) {
    try { history = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')); }
    catch {}
  }
  res.json(history);
});

// 3️⃣ Función de chequeo y webhook
async function checkAndSend() {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-PE,es;q=0.9'
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#ctl00_cphContent_lblFecha', { timeout: 60000 });

  const texto    = await page.textContent('#ctl00_cphContent_lblFecha');
  const fechaSBS = (texto||'').match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
  await browser.close();

  if (!fechaSBS) {
    console.error('❌ No se pudo extraer la fecha de la SBS');
    return;
  }

  const ahoraLima = new Intl.DateTimeFormat('es-PE',{
    timeZone: 'America/Lima', day:'2-digit', month:'2-digit', year:'numeric'
  }).format(new Date());

  // Última fecha enviada
  let ultimaEnviada = null;
  if (fs.existsSync(STORAGE_FILE)) {
    try {
      ultimaEnviada = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8')).fecha;
    } catch {}
  }

  const esHoySBS     = fechaSBS === ahoraLima;
  const yaEnviadaHoy = ultimaEnviada === ahoraLima;

  // Si coincide y no hemos enviado hoy, disparamos webhook
  if (esHoySBS && !yaEnviadaHoy) {
    console.log('🚀 Webhook enviado – fecha:', fechaSBS);
    await axios.post(WEBHOOK_N8N, { fecha: fechaSBS });
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({ fecha: fechaSBS }, null, 2));
  } else {
    console.log('⏸️ Nada que enviar. Fecha SBS:', fechaSBS,
                '| Hoy Lima:', ahoraLima,
                '| Última enviada:', ultimaEnviada || '―');
  }

  // **Registra log** y mantiene sólo últimos N días
  const entry = {
    timestamp: new Date().toISOString(),
    fechaSBS,
    enviado: esHoySBS && !yaEnviadaHoy
  };

  let history = [];
  if (fs.existsSync(LOG_FILE)) {
    try { history = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')); }
    catch { history = []; }
  }
  const now = Date.now();
  history = history.filter(e =>
    now - new Date(e.timestamp).getTime() <= DAYS_TO_KEEP * MS_IN_DAY
  );
  history.push(entry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(history, null, 2));
}

// Arranca inmediatamente y luego cada minuto
checkAndSend().catch(console.error);
setInterval(() => checkAndSend().catch(console.error), EVERY_MINUTE);

// **Levanta Express** para servir el dashboard
app.listen(PORT, () =>
  console.log(`🔌 Servidor corriendo en http://localhost:${PORT}`)
);
