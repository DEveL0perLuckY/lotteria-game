# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy rest of the application
COPY . .

# Expose app port
EXPOSE 8080

# Start the server
CMD ["node", "index.js"]
