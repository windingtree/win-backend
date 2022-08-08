import MongoDBService from '../services/MongoDBService';
import { DBName } from '../config';

export class OfferRepository {
  private dbService: MongoDBService;
  private collectionName = 'offers';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection() {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async bulkCreate(offers: Array<any>): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertMany(offers);
  }

  public async create(offer: any): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertOne(offer);
  }

  public async getOne(offerId: string): Promise<any> {
    const collection = await this.getCollection();

    return await collection.findOne({ id: offerId });
  }
}

export default new OfferRepository();
