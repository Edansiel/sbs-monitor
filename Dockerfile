# Usa una imagen oficinal de Node.js
FROM node:20-slim

# Instala dependencias del sistema necesarias para Playwright
RUN apt-get update && apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxss1 libasound2 \
    libxshmfence1 libgbm-dev wget unzip fonts-liberation libappindicator3-1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia y prepara dependencias
COPY package*.json ./
RUN npm install && npx playwright install --with-deps

# Copia el resto del código
COPY . .

# Exponer puerto para Render (aunque no sirvas web, Express lo necesita)
EXPOSE 3000

CMD ["npm", "start"]
