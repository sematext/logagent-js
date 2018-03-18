CREATE TABLE temperature_by_day (
weatherstation_id text,
date text,
event_time timestamp,
temperature text,
PRIMARY KEY ((weatherstation_id,date),event_time)
);


INSERT INTO temperature_by_day(weatherstation_id,date,event_time,temperature)
VALUES (’1234ABCD’,’2018-04-03′,’2013-04-03 07:01:00′,’72F’);

INSERT INTO temperature_by_day(weatherstation_id,date,event_time,temperature)
VALUES (’1234ABCD’,’2018-04-03′,’2013-04-03 07:02:00′,’73F’);

INSERT INTO temperature_by_day(weatherstation_id,date,event_time,temperature)
VALUES (’1234ABCD’,’2018-04-04′,’2013-04-04 07:01:00′,’73F’);

INSERT INTO temperature_by_day(weatherstation_id,date,event_time,temperature)
VALUES (’1234ABCD’,’2018-04-04′,’2013-04-04 07:02:00′,’74F’);