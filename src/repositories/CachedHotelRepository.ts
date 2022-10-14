import MongoDBService from '../services/MongoDBService';
import { DBName } from '../config';
import { Collection } from 'mongodb';
import { CachedWinAccommodation } from '../types';

export class CachedHotelRepository {
  private dbService: MongoDBService;
  private collectionName = 'cached_hotels';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection(): Promise<Collection<CachedWinAccommodation>> {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async upsert(hotel: CachedWinAccommodation): Promise<void> {
    const collection = await this.getCollection();

    await collection.updateOne(
      { providerHotelId: hotel.providerHotelId },
      { $set: { ...hotel } },
      { upsert: true }
    );
  }

  public async getOne(
    accommodationId: string
  ): Promise<CachedWinAccommodation | null> {
    const collection = await this.getCollection();

    return await collection.findOne({ id: accommodationId });
  }

  public async getByIds(ids: string[]): Promise<CachedWinAccommodation[]> {
    const result: CachedWinAccommodation[] = [];
    const collection = await this.getCollection();

    if ((await collection.countDocuments()) === 0) {
      return [];
    }

    const cursor = await collection.find({ providerHotelId: { $in: ids } });

    await cursor.forEach((item) => {
      result.push(item);
    });

    return result;
  }
}

export default new CachedHotelRepository();
