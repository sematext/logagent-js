FROM mhart/alpine-node:6.0
WORKDIR /src
ADD . /src
RUN npm install -g && npm i rtail -g && chmod +x docker-run-logagent.sh

EXPOSE 514/udp
EXPOSE 80
CMD ["/src/docker-run-logagent.sh"]