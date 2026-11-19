# Production Container for Lead & Job Agent
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package definition and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Set default port
ENV PORT=3777
EXPOSE 3777

# Start server
CMD ["node", "server.js"]
