FROM oven/bun:1.3.13-slim
WORKDIR /app

COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
ARG SLOCK_INSTALL=
ENV SLOCK_INSTALL=$SLOCK_INSTALL
RUN bun run build

ENV SLOCK_DATA=/data
RUN mkdir /data && chown bun /data
VOLUME /data

USER bun
EXPOSE 5175
CMD ["bun", "run", "start"]
