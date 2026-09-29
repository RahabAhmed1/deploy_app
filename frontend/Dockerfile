# ── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .

RUN VITE_API_BASE_URL="" npm run build --ignore-scripts

# ── Serve with Nginx ──────────────────────────────────────────
FROM nginx:1.27-alpine
# vite.config.ts sets outDir to dist/renderer
COPY --from=builder /app/dist/renderer /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
