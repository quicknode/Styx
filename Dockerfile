# Styx collector: API only. The UI is built separately (Vercel, or `npm run build` for a standalone box)
# and the server also serves web/dist when that folder exists next to it.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm i --no-save tsx@^4
COPY server ./server
COPY tsconfig.json ./tsconfig.json
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s CMD wget -qO- http://127.0.0.1:8787/api/networks >/dev/null || exit 1
CMD ["npx", "tsx", "server/index.ts"]
