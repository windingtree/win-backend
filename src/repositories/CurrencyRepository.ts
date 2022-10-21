import MongoDBService from '../services/MongoDBService';
import { DBName } from '../config';
import { Collection } from 'mongodb';
import { CurrencyDbValue } from '../types';

export class CurrencyRepository {
  private dbService: MongoDBService;
  private collectionName = 'currencies';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection(): Promise<Collection<CurrencyDbValue>> {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async upsert(currency: CurrencyDbValue): Promise<void> {
    const collection = await this.getCollection();

    await collection.updateOne(
      { code: currency.code },
      { $set: { ...currency } },
      { upsert: true }
    );
  }

  public async getAll(): Promise<CurrencyDbValue[] | null> {
    const result: CurrencyDbValue[] = [];
    const collection = await this.getCollection();

    if ((await collection.countDocuments()) === 0) {
      return [];
    }

    const cursor = await collection.find();

    await cursor.forEach((item) => {
      result.push(item);
    });

    return result;
  }
}

export default new CurrencyRepository();
