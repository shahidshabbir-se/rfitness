# --- Base Image (Common Setup) ---
FROM node:22-slim AS base
WORKDIR /app

# Install dependencies separately to optimize caching
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile --ignore-scripts

# --- Build Stage (Compiles the Remix App) ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (DO NOT RUN MIGRATIONS)
RUN corepack enable && pnpm install prisma --ignore-scripts
RUN npx prisma generate && pnpm run build

# --- Production Image (Minimal & Secure) ---
FROM node:22-slim AS runner
WORKDIR /app

# Set environment variables (Database must be set in runtime)
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 remix

# Copy only the necessary build files (DO NOT COPY PRISMA)
COPY --from=builder --chown=remix:nodejs /app/build ./build
COPY --from=builder --chown=remix:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=remix:nodejs /app/package.json ./package.json

# Set user permissions
USER remix

# Expose port for GHCR deployments
EXPOSE 3000

# Start the Remix server (Database must be available externally)
CMD ["pnpm", "start"]
