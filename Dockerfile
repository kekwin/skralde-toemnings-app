# Waste collection dates som container til Familien Sommer hub.
# Data (den gemte adresse) ligger i /app/data, som monteres som volume.
FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY public ./public

RUN mkdir -p /app/data && chown node:node /app/data
USER node

EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "server.js"]
