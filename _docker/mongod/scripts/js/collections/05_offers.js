db.createCollection('offers');
db.offers.createIndex({ id: 1 });
db.offers.createIndex({ expiration: 1 }, { expireAfterSeconds: 10 * 60 }); //+ 10m
db.offers.createIndex({ accommodationId: 1 });
db.offers.createIndex({ requestHash: 1 });
db.offers.createIndex({ sessionId: 1 });
