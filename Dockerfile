FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
ARG VITE_API_KEY
ARG VITE_API_URL
ARG VITE_RLM_URL
ARG VITE_WS_URL
ENV VITE_API_KEY=$VITE_API_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_RLM_URL=$VITE_RLM_URL
ENV VITE_WS_URL=$VITE_WS_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=builder /app/dist ./dist
COPY server.mjs ./server.mjs
EXPOSE 8080
CMD ["node", "server.mjs"]
