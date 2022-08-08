import MongoDBService from '../services/MongoDBService';
import { DBName } from '../config';

export class DealRepository {
  private dbService: MongoDBService;
  private collectionName = 'deals';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection() {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async getUserDeals(address: string) {
    const collection = await this.getCollection();

    const result: any[] = [];
    const cursor = await collection.find({ userAddress: address });

    await cursor.forEach((item) => {
      result.push(item);
    });

    return result;
  }

  public async createDeal(
    offer: any,
    dealStorage: any,
    contract: any
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.insertOne({
      contract,
      offer,
      dealStorage,
      offerId: offer.id,
      userAddress: dealStorage.customer,
      status: 'paid',
      message: null,
      createdAt: new Date()
    });
  }

  public async updateDealStatus(
    offerId: string,
    status: string,
    message: string | null
  ): Promise<void> {
    const collection = await this.getCollection();

    await collection.updateOne({ offerId }, { $set: { status, message } });
  }
}

export default new DealRepository();
