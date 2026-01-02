# ================================
# RateIt Backend Dockerfile
# Multi-stage production build
# ================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# ================================
# Stage 2: Production
# ================================
FROM node:20-alpine AS production
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Remove development files
RUN rm -rf .env.example .git* *.md init-db.js

# Set environment variables
# NOTE: Sensitive values (DB_PASSWORD, GEMINI_API_KEY) should be passed at runtime
# via docker-compose.yml or docker run -e, NOT hardcoded here
ENV NODE_ENV=production
ENV PORT=3001
ENV DB_HOST=""
ENV DB_PORT=5432
ENV DB_NAME=""
ENV DB_USER=""
ENV DB_PASSWORD=""
ENV DB_SSL=true
ENV DB_POOL_MAX=20
ENV DB_POOL_IDLE_TIMEOUT=30000
ENV GEMINI_API_KEY=""

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
