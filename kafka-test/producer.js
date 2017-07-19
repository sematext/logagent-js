var kafka = require('kafka-node');
var Producer = kafka.Producer;
var KeyedMessage = kafka.KeyedMessage;
var Client = kafka.Client;
var clientId = 'kafka-node-client-' + 44;
var client = new Client('localhost',clientId,undefined, undefined, false);
var topic = 'test';
var p = 0;
var a = 0;
var producer = new Producer(client, { requireAcks: 1 });

producer.on('ready', function () {
  
  
  for(var i = 0 ; i < 10 ; i++) {
    var message = 'a message : ' + i ;
    console.log('send message ' + message)
    producer.send([
      { topic: topic, messages: message}
    ], function (err, result) {
      if(err){
        console.log('errore' + err)
      }
      
      console.log(err || result);
      process.exit();
    });
  }
});

producer.on('error', function (err) {
  console.log("Errore ci passa");
});

producer.close(function (err) {
  console.log('error', err);
});
