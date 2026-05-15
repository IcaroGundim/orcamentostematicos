FROM node:22-alpine AS builder

WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

RUN npm install

COPY apps/api ./apps/api

WORKDIR /app/apps/api

RUN npm run build

# --- Production image ---
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/

RUN npm install --omit=dev

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

WORKDIR /app/apps/api

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/main.js"]
