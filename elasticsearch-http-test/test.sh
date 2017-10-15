cd elasticsearch-test
docker-compose version 
docker version
if [[ "$(docker ps)" =~ "elastic" ]]; then 
  docker-compose stop && true
  docker-compose rm -f && true
fi 
docker-compose up -d 
sleep 25

#curl -s -H "Content-Type: application/x-ndjson" -XPOST localhost:9900/_bulk --data-binary "@requests
#sleep 10
curl 'localhost:9200/_cat/indices?v' 2>&1 | grep mytest
