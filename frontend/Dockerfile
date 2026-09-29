# ── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
# --ignore-scripts skips the postinstall that tries to install backend
RUN npm ci --ignore-scripts

COPY . .

# VITE_API_BASE_URL is intentionally left empty so the frontend
# uses the Nginx reverse proxy (/api/* → backend-service:5000)
RUN VITE_API_BASE_URL="" npm run build

# ── Serve with Nginx ──────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
