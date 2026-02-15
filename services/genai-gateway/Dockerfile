# ──────────────────────────────────────────────
# Dockerfile — GenAI Inference Gateway
# ──────────────────────────────────────────────
FROM node:18-alpine

WORKDIR /app

# Install dependencies first (layer caching)
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY src/ ./src/

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:4000/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
