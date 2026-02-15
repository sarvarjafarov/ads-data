# ──────────────────────────────────────────────
# Dockerfile — Main API Service (Dashly)
# ──────────────────────────────────────────────
FROM node:18-alpine

# Puppeteer/Chromium dependencies for website-audit service
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use the system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY src/ ./src/
COPY public/ ./public/
COPY data/ ./data/
COPY tests.json team-kpis.json ./

# The original AI service files are kept in place as a fallback.
# When GENAI_GATEWAY_URL is set, the gateway client proxies calls to the gateway.
# When it is NOT set, the gateway client's axios calls would fail, but the
# original service files remain available for standalone/monolith mode.

EXPOSE 3000

CMD ["node", "src/server.js"]
