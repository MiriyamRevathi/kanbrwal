# Multi-stage Docker build for Kanbrawl Enterprise Project Management Web Application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package.json package-lock.json ./
RUN npm ci

# Copy source files
COPY tsconfig.json vitest.config.ts ./
COPY src/ ./src/

# Build server and client
RUN npm run build

# ── Production Runtime Stage ──
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8431

# Copy dependency specifications and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled artifacts from builder stage
COPY --from=builder /app/dist ./dist

# Create persistent data volume directory
RUN mkdir -p /app/data && chown -R node:node /app

USER node

# Expose Web & MCP port
EXPOSE 8431

# Data volume for JSON persistence
VOLUME ["/app/data"]

# Run the enterprise web server directly
CMD ["node", "dist/server/index.js"]
