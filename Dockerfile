# Base stage for Node.js setup
FROM node:22-slim AS base

# Install OpenSSL in base to make it available everywhere
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY package.json pnpm-lock.yaml* .npmrc* ./
RUN corepack enable && pnpm install 

# Build the Remix application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure OpenSSL is installed before running Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN corepack enable && npx prisma generate && pnpm run build

# Production stage (use Debian instead of Alpine)
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install OpenSSL again in the runner stage
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 remix

# Copy only necessary build output
COPY --from=builder --chown=remix:nodejs /app/build ./build
COPY --from=builder --chown=remix:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=remix:nodejs /app/package.json ./package.json
COPY --from=builder --chown=remix:nodejs /app/prisma ./prisma

# Set correct permissions for the non-root user
USER remix

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run remix-serve
ENTRYPOINT ["npx", "--no-update-notifier", "remix-serve"]
CMD ["build/server/index.js"]
