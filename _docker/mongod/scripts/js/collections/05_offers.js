db.createCollection('offers');
db.offers.createIndex({ id: 1 });
db.offers.createIndex({ expiration: 1 }, { expireAfterSeconds: 10 * 60 }); //+ 10m
