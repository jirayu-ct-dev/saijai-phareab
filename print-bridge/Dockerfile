FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /gateway

COPY --chown=node:node . ./

RUN mkdir -p /data && chown node:node /data

USER node
EXPOSE 17321

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["node", "healthcheck.mjs"]

CMD ["node", "bin/bridge.mjs"]
