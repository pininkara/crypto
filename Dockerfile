# --------- Stage 1: Build Frontend ---------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web

# 配置 npm 源可选，提升国内速度
# RUN npm config set registry https://registry.npmmirror.com

COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build

# --------- Stage 2: Build Backend ---------
FROM golang:alpine AS backend-builder
WORKDIR /app

# GORM SQLite 需要 CGO 支持
RUN apk add --no-cache gcc musl-dev

# 优化国内拉取可选
# ENV GOPROXY=https://goproxy.cn,direct

COPY go.mod go.sum ./
RUN go mod download
COPY . .

# 编译应用
RUN CGO_ENABLED=1 GOOS=linux go build -a -ldflags="-s -w" -o crypto-toolbox ./cmd/server

# --------- Stage 3: Final Environment ---------
FROM alpine:latest
WORKDIR /app

# 添加 tzdata 时间库及 sqlite 运行时动态库(如有必要)
RUN apk add --no-cache tzdata

COPY --from=frontend-builder /app/web/dist ./web/dist
COPY --from=backend-builder /app/crypto-toolbox ./
COPY config.example.toml ./config.toml

# 保证数据目录在预设置前存在
RUN mkdir -p data

EXPOSE 8080
VOLUME ["/app/data", "/app/config"]

CMD ["./crypto-toolbox"]
