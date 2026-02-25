FROM node:20-alpine AS builder
WORKDIR /app

# Copy shared library first
COPY shared/ ../shared/
RUN cd ../shared && npm install && npm run build

# Copy mint-service
COPY mint-service/package*.json ./
RUN npm install
COPY mint-service/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/server.js"]
