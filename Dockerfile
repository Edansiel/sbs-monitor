# ✅ Usa una imagen oficial de Node.js
FROM node:20-slim

# 🧱 Instala dependencias del sistema necesarias para Playwright
RUN apt-get update && apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxss1 libasound2 \
    libxshmfence1 libgbm-dev wget unzip fonts-liberation libappindicator3-1 \
    && rm -rf /var/lib/apt/lists/*

# 🗂️ Directorio de trabajo
WORKDIR /app

# 📦 Copiar y preparar dependencias
COPY package*.json ./
RUN npm install && npx playwright install --with-deps

# 📁 Copiar el código
COPY . .

# 🌐 Exponer puerto (opcional si no usas servidor web)
EXPOSE 3000

# ▶️ Ejecutar script
CMD ["node", "index.js"]
