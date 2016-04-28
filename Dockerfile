FROM mhart/alpine-node:6.0
WORKDIR /src
ADD . /src
RUN npm install -g && chmod +x run.sh

EXPOSE 514/udp
CMD ["/src/docker-run-logagent.sh"]