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
    providerHotelId: string
  ): Promise<CachedWinAccommodation | null> {
    const collection = await this.getCollection();

    return await collection.findOne({ providerHotelId });
  }
}

export default new CachedHotelRepository();
