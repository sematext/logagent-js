FROM node:12-alpine

ENV REGION="US"

RUN \
  apk add --no-cache --update bash tini && \
  rm -rf /var/cache/apk/*

RUN \ 
  apk add --no-cache --virtual .build-deps alpine-sdk python && \ 
  npm install -g --unsafe-perm --production git+https://sematext@github.com/sematext/logagent-js.git && \
  npm install -g --unsafe-perm --production @sematext/logagent && \
  npm install -g --production --unsafe-perm @sematext/logagent-nodejs-monitor && \
  mkdir -p /etc/sematext && \
  mkdir -p /etc/logagent && \
  mkdir -p /opt/logagent && \
  touch /opt/logagent/patterns.yml && \
  npm rm -g npm && \
  rm -rf ~/.npm && \
  rm -rf /tmp/* && \
  apk del .build-deps 

COPY patterns.yml /etc/logagent/patterns.yml
COPY run.sh /run.sh
RUN chmod +x /run.sh
HEALTHCHECK --interval=1m --timeout=10s CMD ps -ef | grep -v grep | grep -e logagent || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/run.sh"]
