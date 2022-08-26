db.createCollection('deals');
db.deals.createIndex({ userAddress: 1 });
db.deals.createIndex({ offerId: 1 });
db.deals.createIndex({ orderId: 1 });
db.deals.createIndex({ supplierReservationId: 1 });
