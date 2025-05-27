# ✅ Imagen oficial de Playwright con navegadores ya preinstalados
FROM mcr.microsoft.com/playwright:v1.41.0-jammy

# 🗂️ Directorio de trabajo dentro del contenedor
WORKDIR /app

# 📦 Copiar archivos de dependencias primero
COPY package*.json ./

# 🧰 Instalar dependencias del proyecto
RUN npm install

# 📁 Copiar el resto del código
COPY . .

# 🌐 Render necesita que se exponga un puerto (aunque no lo uses)
EXPOSE 3000

# ▶️ Comando para iniciar tu script
CMD ["node", "index.js"]
