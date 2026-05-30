# Stage 1: Build React Application
FROM node:20-alpine AS build
WORKDIR /app

# Copy package configuration files
COPY package*.json ./

# Install dependencies (using npm install because lockfile is out of sync)
RUN npm install --no-audit --no-fund

# Copy full UI codebase
COPY . .

# Build the React production bundle
RUN npm run build

# Stage 2: Serve build assets with NGINX
FROM nginx:alpine

# Copy built static content from Stage 1 to Nginx directory
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom Nginx reverse proxy configuration
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
