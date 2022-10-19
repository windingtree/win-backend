db.createCollection('cached_hotels');
db.cached_hotels.createIndex({ location: '2dsphere' });
db.cached_hotels.createIndex({ hotelId: 1 });
db.cached_hotels.createIndex({ provider: 1 });
db.cached_hotels.createIndex({ hotelId: 1, provider: 1 });
db.cached_hotels.createIndex({ providerHotelId: 1 });
