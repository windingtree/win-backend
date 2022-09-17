import MongoDBService from '../services/MongoDBService';
import { DBName } from '../config';
import { OfferDBValue } from '../types';
import { Collection } from 'mongodb';

export class OfferRepository {
  private dbService: MongoDBService;
  private collectionName = 'offers';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection(): Promise<Collection<OfferDBValue>> {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async bulkCreate(offers: Array<OfferDBValue>): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertMany(offers);
  }

  public async create(offer: OfferDBValue): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertOne(offer);
  }

  public async getOne(offerId: string): Promise<OfferDBValue | null> {
    const collection = await this.getCollection();

    return await collection.findOne({ id: offerId });
  }

  public async getByAccommodation(
    accommodationId: string
  ): Promise<OfferDBValue[]> {
    const result: OfferDBValue[] = [];
    const collection = await this.getCollection();

    if ((await collection.countDocuments()) === 0) {
      return [];
    }

    const cursor = await collection.find({ accommodationId });

    await cursor.forEach((item) => {
      result.push(item);
    });

    return result;
  }

  public async getBySession(
    sessionId: string,
    requestHash: string
  ): Promise<OfferDBValue[]> {
    const result: OfferDBValue[] = [];
    const collection = await this.getCollection();

    if ((await collection.countDocuments()) === 0) {
      return [];
    }

    const cursor = await collection.find({ sessionId, requestHash });

    await cursor.forEach((item) => {
      result.push(item);
    });

    return result;
  }

  public async upsertOffer(offer: OfferDBValue): Promise<void> {
    const collection = await this.getCollection();

    await collection.updateOne(
      { id: offer.id },
      { $set: { ...offer } },
      { upsert: true }
    );
  }
}

export default new OfferRepository();
