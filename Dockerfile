FROM node:20-alpine AS base

# Install build tools needed for better-sqlite3 native addon
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./

# Install production dependencies only and rebuild native addons
RUN npm ci --omit=dev && npm rebuild better-sqlite3

# Copy application source
COPY bin/   ./bin/
COPY src/   ./src/
COPY public/ ./public/

# Adminer-node listens on HOST:PORT — bind to 0.0.0.0 inside the container
ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["node", "bin/adminer-node.js", "--no-open"]
