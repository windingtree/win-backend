db.createCollection('hotels');
db.hotels.createIndex({ location: '2dsphere' });
db.hotels.createIndex({ hotelId: 1 });
db.hotels.createIndex({ provider: 1 });
db.hotels.createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 }); //1h
db.hotels.createIndex({ id: 1 });
