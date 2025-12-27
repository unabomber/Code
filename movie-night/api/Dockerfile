FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm i
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY --from=build /app/dist ./dist

# SQLite file lives here (mounted as volume)
ENV DB_PATH=/data/data.sqlite

EXPOSE 3000
CMD ["node", "dist/index.js"]
