FROM balenalib/aarch64-alpine-node:10-3.7

RUN [ "cross-build-start" ]

ENV MAX_MEM="--max-old-space-size=300"
ENV REGION="US"

RUN \
  apk add --update bash tini && \
  rm -rf /var/cache/apk/*

RUN \
  npm install -g --unsafe-perm @sematext/logagent && \
  mkdir -p /etc/sematext && \
  mkdir -p /opt/logagent && \
  touch /opt/logagent/patterns.yml && \
  rm -rf /tmp/* /root/.npm

COPY patterns.yml /opt/logagent/patterns.yml
COPY run.sh /run.sh
RUN chmod +x /run.sh
HEALTHCHECK --interval=1m --timeout=10s CMD ps -ef | grep -v grep | grep -e logagent || exit 1

RUN [ "cross-build-end" ]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/run.sh"]
