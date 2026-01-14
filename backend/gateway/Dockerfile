# Use official Node.js image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port (Render sets this ENV automatically, but good practice)
EXPOSE 5000 5001 5002

# Start the app
CMD ["node", "server.js"]