const { chromium } = require('playwright');
const fs = require('fs');
const axios = require('axios');

const URL = 'https://www.sbs.gob.pe/app/pp/sistip_portal/paginas/publicacion/tipocambiopromedio.aspx';
const STORAGE_FILE = './storage.json';
const WEBHOOK_N8N = 'https://jeancarlovidela.app.n8n.cloud/webhook/8f405f9f-2fc3-459b-9b04-bd190c5fe17c';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-PE,es;q=0.9',
  });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('#ctl00_cphContent_lblFecha', { timeout: 60000 });

  // 📅 Extraer la fecha del sitio
  const textoFecha = await page.textContent('#ctl00_cphContent_lblFecha');
  const fechaSBS = textoFecha?.trim().match(/\d{2}\/\d{2}\/\d{4}/)?.[0]; // ej. "27/05/2025"

  if (!fechaSBS) {
    console.error('❌ No se pudo leer la fecha del sitio');
    await browser.close();
    return;
  }

  // 📆 Obtener fecha actual en Lima (UTC-5) usando solo JavaScript
  const ahoraUTC = new Date();
  const offsetLima = -5 * 60;
  const fechaLima = new Date(ahoraUTC.getTime() + offsetLima * 60 * 1000);

  // 🔄 Formatear fecha como "dd/mm/yyyy"
  const fechaLimaFormateada = fechaLima.toLocaleDateString('es-PE', {
    timeZone: 'UTC', // ya ajustamos la hora antes
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  console.log(`🕓 Fecha SBS: ${fechaSBS} | Fecha Lima: ${fechaLimaFormateada}`);

  // 🗂️ Leer archivo local
  let ultimaFechaEnviada = null;
  if (fs.existsSync(STORAGE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
      ultimaFechaEnviada = parsed.fecha;
    } catch (e) {
      console.warn('⚠️ Error leyendo storage.json');
    }
  }

  const debeEnviar = fechaSBS === fechaLimaFormateada && fechaSBS !== ultimaFechaEnviada;

  if (debeEnviar) {
    console.log('🚀 Enviando al webhook:', fechaSBS);
    await axios.post(WEBHOOK_N8N, { fecha: fechaSBS });
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({ fecha: fechaSBS }));
  } else {
    console.log('✅ Sin cambios o ya se envió hoy.');
  }

  await browser.close();
})();