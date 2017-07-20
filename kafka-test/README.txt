# Logagent kafka example
Logagent support Kafka broker from version 0.9 or Higher. 
At the moment is possible to consume and produce message from Kafka Broker in plaintext mode and through SSL mode.
Here an simple examples to test this functionality with Kafka `0.10.2.1`

##Consume message in plaintest from Logagent

* kafka-test/start-docker-test.sh
* node kafka-test/producer.js
* node bin/logagent.js -c config/examples/kafka-stdout-yml.yml

sslEnable: false

##Consume message through SSL  from Logagent

* kafka-test/start-docker-test.sh
* node kafka-test/producer-ssl.js
* set sslEnable: true in config/examples/kafka-stdout-yml.yml
* node bin/logagent.js -c config/examples/kafka-stdout-yml.yml



##Produce message from Logagent in plaintest

* kafka-test/start-docker-test.sh
* node bin/logagent.js -c config/examples/stdin-kafka-yml.yml
* type a string like 'AAAAAAAAAAAAAA'
* node kafka-test/consumer.js


##Produce message from Logaget through SSL

* kafka-test/start-docker-test.sh
* set sslEnable: true in config/examples/stdin-kafka-yml.yml
* node bin/logagent.js -c config/examples/stdin-kafka-yml.yml
* type a string like 'AAAAAAAAAAAAAA'
* node kafka-test/consumer.js