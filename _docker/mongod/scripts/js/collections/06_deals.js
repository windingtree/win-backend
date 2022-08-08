db.createCollection('deals');
db.deals.createIndex({ userAddress: 1 });
db.deals.createIndex({ offerId: 1 });
