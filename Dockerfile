# --- BUILDER STAGE ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies for compilation)
RUN npm ci

# Copy source code files
COPY src ./src

# Compile TypeScript to JavaScript
RUN npm run build

# --- RUNNER STAGE ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package descriptors
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy compiled JavaScript files from builder stage
COPY --from=builder /app/dist ./dist

# Copy migrations folder for Drizzle migrations at startup
COPY drizzle ./drizzle

# Create a non-privileged system user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose service health check port
EXPOSE 8080

# Start background cron worker
CMD ["node", "dist/index.js"]
