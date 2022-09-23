db.createCollection('sessions');
db.sessions.createIndex({ uuid: 1 });
db.sessions.createIndex({ expiredAt: 1 }, { expireAfterSeconds: 0 });
