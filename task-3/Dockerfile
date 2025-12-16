# Multi-stage Dockerfile for optimized production builds
# Stage 1: Build stage - compile TypeScript to JavaScript
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
# This allows Docker to cache npm install if dependencies haven't changed
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY src ./src
COPY migrations ./migrations
COPY seeds ./seeds
COPY knexfile.js ./

# Build TypeScript to JavaScript
RUN npm run build

# Remove development dependencies to reduce image size
RUN npm prune --production

# Stage 2: Production stage - minimal runtime environment
FROM node:18-alpine

# Set NODE_ENV to production for optimizations
ENV NODE_ENV=production

# Create non-root user for security best practices
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy only necessary files from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nodejs:nodejs /app/seeds ./seeds
COPY --from=builder --chown=nodejs:nodejs /app/knexfile.js ./

# Create logs directory with proper permissions
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/server.js"]
