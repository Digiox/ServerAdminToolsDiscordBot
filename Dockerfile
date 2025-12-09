FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --omit=dev

COPY . .

RUN cd frontend && npm run build && cd .. && npm run build

EXPOSE 3000
CMD ["npm", "start"]
