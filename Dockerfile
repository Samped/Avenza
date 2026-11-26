# Multi-stage: API + Web for public hackathon demo
FROM node:22-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/
COPY packages/chain/package.json packages/chain/
RUN npm install --ignore-scripts || npm install

FROM deps AS build
COPY . .
RUN npm run build -w @avenza/shared && npm run build -w @avenza/chain \
 && npm run build -w @avenza/api && npm run build -w @avenza/web

FROM node:22-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

FROM node:22-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@avenza/web"]
