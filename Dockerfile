# Use the latest Ubuntu image
FROM ubuntu:latest

# Update system packages
RUN apt update && apt upgrade -y

# Install base packages
RUN apt install -y curl wget git ca-certificates

# Install Node.js 26 from NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_26.x | bash - \
    && apt install -y nodejs

# Install PM2 so pm2-runtime is available inside the container
RUN npm install -g pm2 && npm cache clean --force

# Set the container working directory
WORKDIR /Auto-Ban

# Start bash by default when the container starts
CMD [ "bash" ]