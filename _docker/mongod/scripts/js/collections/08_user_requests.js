db.createCollection('sessions');
db.deals.createIndex({ accommodationId: 1 });
db.deals.createIndex({ requestHash: 1 });
db.deals.createIndex({ sessionId: 1 });
db.deals.createIndex({ startDate: 1 }, { expireAfterSeconds: 60 * 60 * 24 }); //will delete after 1 day
