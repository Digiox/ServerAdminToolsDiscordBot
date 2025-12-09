FROM node:22-bookworm-slim
WORKDIR /app

# Install root deps (include dev for build)
COPY package.json package-lock.json ./
RUN npm ci

# Install frontend deps (include dev for build)
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

# Copy source
COPY . .

# Build frontend then backend
RUN rm -rf frontend/dist && cd frontend && npm run build
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
