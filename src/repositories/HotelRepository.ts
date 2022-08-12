import MongoDBService from '../services/MongoDBService';
import { DBName } from '../config';
import { Collection } from 'mongodb';
import { Hotel } from '../types';

export class HotelRepository {
  private dbService: MongoDBService;
  private collectionName = 'hotels';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection(): Promise<Collection<Hotel>> {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async searchByRadius(
    lon: number,
    lat: number,
    radius: number,
    ids: string[]
  ): Promise<Hotel[]> {
    const collection = await this.getCollection();

    const cursor = await collection.find({
      id: { $in: ids },
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

    const hotels = new Set<Hotel>();

    await cursor.forEach((item) => {
      hotels.add(item);
    });

    return Array.from(hotels);
  }

  public async bulkCreate(hotels: Hotel[]): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertMany(hotels);
  }
}

export default new HotelRepository();
