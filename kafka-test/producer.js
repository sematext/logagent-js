var kafka_native = require('kafka-native');

var broker = 'localhost:9092';
var topic = 'test';

function produceMessage() {
    var producer = new kafka_native.Producer({
        broker: broker
    });

    producer.partition_count(topic)
    .then(function(npartitions) {
        var partition = 0;
        setInterval(function() {
            for(var i = 0; i < 100; ++i){
                message = 'messageProduced-' + i 
                console.log('producer send message ' + message + ' to partition' + partition); 
                producer.send(topic, partition, [message]);
                partition = (partition + 1) % npartitions;
            }
        }, 1000);
    });
}

produceMessage();