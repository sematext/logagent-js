cd elasticsearch-test

docker-compose version 
docker version
if [[ "$(docker ps)" =~ "elastic" ]]; then 
  docker-compose stop && true
  docker-compose rm -f && true
fi 
docker-compose up -d 
ps -ef |grep elastic-http | awk '{print $2}' | xargs kill 
../bin/logagent.js --config ../config/examples/elastic-http-input.yml & 
sleep 20

curl -s -H "Content-Type: application/x-ndjson" -XPOST localhost:9900/_bulk --data-binary "@requests"
sleep 30
curl 'localhost:9200/_cat/indices?v' 2>&1 | grep mytest
curl 'localhost:9200/mytest/_search' | ../bin/logagent.js -y 
curl 'localhost:9200/mytest/_count'  | ../bin/logagent.js -y  
sleep 5
ps -ef |grep elastic-http | awk '{print $2}' | xargs kill -3
