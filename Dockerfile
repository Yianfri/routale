FROM node:24.22.1-alpine AS build
# El npm de la base incluye undici/brace-expansion afectados; fijar la revisión corregida.
RUN npm install --global --ignore-scripts --no-audit --no-fund npm@11.21.2 && npm cache clean --force
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Solo servidor estático/proxy: no se necesitan módulos de imágenes ni XSLT.
FROM nginx:1.30.6-alpine-slim
ARG NGINX_CONFIG=deploy/nginx.conf
COPY ${NGINX_CONFIG} /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/frontend/dist/routale/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
