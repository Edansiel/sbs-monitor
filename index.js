const { chromium } = require('playwright');
const fs = require('fs');
const axios = require('axios');

const URL = 'https://www.sbs.gob.pe/app/pp/sistip_portal/paginas/publicacion/tipocambiopromedio.aspx';
const STORAGE_FILE = './storage.json';
const WEBHOOK_N8N = 'https://jeancarlovidela.app.n8n.cloud/webhook/8f405f9f-2fc3-459b-9b04-bd190c5fe17c';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 🔐 Setear cabeceras para evitar bloqueo por bots
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-PE,es;q=0.9',
  });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });

  // Esperar a que aparezca la fecha
  await page.waitForSelector('#ctl00_cphContent_lblFecha', { timeout: 60000 });
  const fecha = await page.textContent('#ctl00_cphContent_lblFecha');

  // Leer última fecha registrada
  let lastFecha = null;

  if (fs.existsSync(STORAGE_FILE)) {
    const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
    try {
      const parsed = JSON.parse(content);
      lastFecha = parsed.fecha || null;
    } catch (e) {
      console.warn('⚠️ Archivo JSON inválido o vacío. Reiniciando...');
      lastFecha = null;
    }
  }  

  // Comparar
  if (fecha !== lastFecha) {
    console.log('📢 Cambio detectado:', fecha);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({ fecha }));
    await axios.post(WEBHOOK_N8N, { fecha });
  } else {
    console.log('✅ Sin cambios:', fecha);
  }

  await browser.close();
})();
