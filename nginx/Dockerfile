# ─── Stage 1: build the React/Vite frontend ────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app

# Install deps with a clean lockfile-driven install for reproducibility
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy source and build
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: nginx serving the build + reverse-proxy ──────
FROM nginx:alpine

# Replace the default site
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d/

# Drop the React build into nginx's web root
COPY --from=frontend-build /app/dist /usr/share/nginx/html
