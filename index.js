// index.js
const { chromium } = require('playwright');
const fs     = require('fs');
const axios  = require('axios');

const URL          = 'https://www.sbs.gob.pe/app/pp/sistip_portal/paginas/publicacion/tipocambiopromedio.aspx';
const STORAGE_FILE = './storage.json';
const WEBHOOK_N8N  = 'https://jeancarlovidela.app.n8n.cloud/webhook/8f405f9f-2fc3-459b-9b04-bd190c5fe17c';
const EVERY_MINUTE = 60_000;       // 1 min en ms

async function checkAndSend () {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  await page.setExtraHTTPHeaders({
    'User-Agent'      : 'Mozilla/5.0',
    'Accept'          : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language' : 'es-PE,es;q=0.9',
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('#ctl00_cphContent_lblFecha', { timeout: 60_000 });

  // 📅 Ej: "Tipo de Cambio al 27/05/2025"
  const texto     = await page.textContent('#ctl00_cphContent_lblFecha');
  const fechaSBS  = (texto || '').match(/\d{2}\/\d{2}\/\d{4}/)?.[0];           // "27/05/2025"
  await browser.close();

  if (!fechaSBS) {
    console.error('❌  No se pudo extraer la fecha de la SBS');
    return;
  }

  // 🗓️ Fecha actual en Lima, sin librerías externas
  const ahoraLima = new Intl.DateTimeFormat('es-PE', {
    timeZone : 'America/Lima',
    day      : '2-digit',
    month    : '2-digit',
    year     : 'numeric'
  }).format(new Date());                                                     // "27/05/2025"

  // 🗂️ Lee la última fecha enviada (si existe)
  let ultimaEnviada = null;
  if (fs.existsSync(STORAGE_FILE)) {
    try { ultimaEnviada = JSON.parse(fs.readFileSync(STORAGE_FILE)).fecha; }
    catch { /* archivo vacío/corrupto ⇒ lo ignoramos */ }
  }

  const esHoySBS     = fechaSBS === ahoraLima;
  const yaEnviadaHoy = ultimaEnviada === ahoraLima;

  if (esHoySBS && !yaEnviadaHoy) {
    console.log('🚀  Webhook enviado – fecha:', fechaSBS);
    await axios.post(WEBHOOK_N8N, { fecha: fechaSBS });
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({ fecha: fechaSBS }));
  } else {
    console.log('⏸️   Nada que enviar.  Fecha SBS:', fechaSBS,
                '| Hoy Lima:', ahoraLima,
                '| Última enviada:', ultimaEnviada ?? '―');
  }
}

// ⏲️ Primer disparo inmediato y luego cada minuto
checkAndSend().catch(console.error);
setInterval(() => checkAndSend().catch(console.error), EVERY_MINUTE);
