FROM oven/bun:1.4.2 AS build
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
ARG PLUGINS=core
RUN bun plugin install --yes ${PLUGINS}

FROM oven/bun:1.4.2-slim
WORKDIR /app
COPY --from=build /app/instance/server.js ./
COPY --from=build /app/instance/client ./client
RUN mkdir data && chown bun data
VOLUME /app/data
USER bun
EXPOSE 5175
CMD ["bun", "server.js"]
