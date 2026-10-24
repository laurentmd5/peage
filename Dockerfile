# syntax=docker/dockerfile:1
FROM node:24-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build client React application
RUN npm run build:client

# Production runtime stage
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Install runtime utilities (curl for container healthcheck, libc6-compat for esbuild)
RUN apk add --no-cache curl libc6-compat

# Copy package and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built frontend, server code, and runtime configs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/public ./client/public
COPY --from=builder /app/server ./server
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 3001

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:3001/api/health || exit 1

CMD ["npm", "start"]
