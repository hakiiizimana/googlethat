# Use crawl4ai as the base image
FROM unclecode/crawl4ai:latest

# Switch to root to install Node.js and configure the app
USER root

# Install Node.js 20.x
RUN apt-get update && \
    apt-get install -y ca-certificates curl gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set up the Node.js app in a separate directory (crawl4ai owns /app)
WORKDIR /stophy

# Copy dependency files first for better layer caching
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy the rest of the application source
COPY . .

# Create crawl4ai data directory and fix permissions
RUN mkdir -p /root/.crawl4ai && chmod 777 /root/.crawl4ai && \
    chmod 755 /root

# Update gunicorn to run as root (matching our USER) and add Node.js app
RUN sed -i 's/user=appuser/user=root/g' /app/supervisord.conf && \
    printf '\n\
[program:googlethat]\n\
command=node /googlethat/server.js\n\
directory=/googlethat\n\
user=root\n\
autorestart=true\n\
priority=30\n\
stdout_logfile=/dev/stdout\n\
stdout_logfile_maxbytes=0\n\
stderr_logfile=/dev/stderr\n\
stderr_logfile_maxbytes=0\n' >> /app/supervisord.conf

# Expose the Node app port and crawl4ai port
EXPOSE 5000 11235

# Use supervisord to manage all processes (crawl4ai + redis + node app)
CMD ["supervisord", "-c", "/app/supervisord.conf"]
