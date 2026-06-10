# Etapa de construcción
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build -- --configuration production

# Etapa de producción
FROM nginx:alpine
# Copiamos los archivos de compilación de Angular a Nginx
COPY --from=build /app/dist/wm-frontend/browser /usr/share/nginx/html
# Copiamos la configuración personalizada de Nginx para Angular (soporte de rutas)
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
