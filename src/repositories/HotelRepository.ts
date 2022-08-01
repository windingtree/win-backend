import MongoDBService from '../services/MongoDBService';
import { DBName } from '../config';

export class HotelRepository {
  private dbService: MongoDBService;
  private collectionName = 'hotels';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection() {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async searchByRadius(lon: number, lat: number, radius: number) {
    const collection = await this.getCollection();

    const cursor = await collection.find({
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [lon, lat]
          },
          $maxDistance: radius
        }
      }
    });

    const hotels = new Set();

    await cursor.forEach((item) => {
      hotels.add(item);
    });

    return Array.from(hotels);
  }

  public async upsertHotels(hotels) {
    const collection = await this.getCollection();

    for (const hotel of hotels) {
      await collection.updateOne(
        { hotelId: hotel.hotelId, provider: hotel.provider },
        { $set: hotel },
        { upsert: true }
      );
    }
  }
}

export default new HotelRepository();
