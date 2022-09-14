db.createCollection('sessions');
db.deals.createIndex({ uuid: 1 });
db.deals.createIndex({ expiredAt: 1 }, { expireAfterSeconds: 0 });
