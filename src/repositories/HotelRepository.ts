import MongoDBService from '../services/MongoDBService';
import { DBName } from '../config';
import { Collection } from 'mongodb';
import { WinAccommodation } from '@windingtree/glider-types/dist/win';

export class HotelRepository {
  private dbService: MongoDBService;
  private collectionName = 'hotels';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection(): Promise<Collection<WinAccommodation>> {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async searchByRadius(
    lon: number,
    lat: number,
    radius: number,
    ids: string[]
  ): Promise<WinAccommodation[]> {
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

    const hotels = new Set<WinAccommodation>();

    await cursor.forEach((item) => {
      hotels.add(item);
    });

    return Array.from(hotels);
  }

  public async bulkCreate(hotels: WinAccommodation[]): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertMany(hotels);
  }

  public async getOne(
    accommodationId: string
  ): Promise<WinAccommodation | null> {
    const collection = await this.getCollection();

    return await collection.findOne({ id: accommodationId });
  }
}

export default new HotelRepository();
