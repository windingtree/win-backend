db.createCollection('user_requests');
db.user_requests.createIndex({ accommodationId: 1 });
db.user_requests.createIndex({ requestHash: 1 });
db.user_requests.createIndex({ sessionId: 1 });
db.user_requests.createIndex(
  { startDate: 1 },
  { expireAfterSeconds: 60 * 60 * 24 }
); //will delete after 1 day
