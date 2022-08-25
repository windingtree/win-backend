import MongoDBService from '../services/MongoDBService';
import { DBName } from '../config';
import { Collection } from 'mongodb';
import {
  DealDBValue,
  DealStatus,
  DealStorage,
  OfferDBValue,
  RewardTypes
} from '../types';
import { NetworkInfo } from '@windingtree/win-commons/dist/types';

export class DealRepository {
  private dbService: MongoDBService;
  private collectionName = 'deals';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection(): Promise<Collection<DealDBValue>> {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async getUserDeals(address: string): Promise<DealDBValue[]> {
    const collection = await this.getCollection();

    const result: DealDBValue[] = [];
    const cursor = await collection.find({ userAddress: address });

    await cursor.forEach((item) => {
      result.push(item);
    });

    return result;
  }

  public async createDeal(
    offer: OfferDBValue,
    dealStorage: DealStorage,
    contract: NetworkInfo,
    addresses: string[]
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.insertOne({
      contract,
      offer,
      dealStorage,
      offerId: offer.id,
      userAddress: addresses,
      status: 'paid',
      message: undefined,
      createdAt: new Date(),
      rewardOption: undefined
    });
  }

  public async updateDeal(
    offerId: string,
    status: DealStatus,
    message: string | undefined = undefined,
    orderId: string | undefined = undefined
  ): Promise<void> {
    const collection = await this.getCollection();

    await collection.updateOne(
      { offerId },
      { $set: { status, message, orderId } }
    );
  }

  public async getDeal(offerId: string): Promise<DealDBValue> {
    const collection = await this.getCollection();
    const deal = await collection.findOne({ offerId });
    if (!deal) {
      throw new Error('Deal not found');
    }
    return deal;
  }

  public async updateRewardOption(
    offerId: string,
    rewardOption: RewardTypes
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne({ offerId }, { $set: { rewardOption } });
  }
}

export default new DealRepository();
