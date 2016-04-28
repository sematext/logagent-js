FROM mhart/alpine-node:6.0
WORKDIR /src
ADD . /src
RUN npm install -g && chmod +x docker-run-logagent.sh.sh

EXPOSE 514/udp
EXPOSE 8080
CMD ["/src/docker-run-logagent.sh"]