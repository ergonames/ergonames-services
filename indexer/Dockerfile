FROM oven/bun:1 as base

RUN mkdir -p /app

WORKDIR /app

COPY . .

RUN bun install

CMD ["bun", "start"]