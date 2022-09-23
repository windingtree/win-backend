import MongoDBService from '../services/MongoDBService';
import { DBName } from '../config';
import { Collection } from 'mongodb';
import { OfferBackEnd } from '../types';

export class OfferRepository {
  private dbService: MongoDBService;
  private collectionName = 'offers';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection(): Promise<Collection<OfferBackEnd>> {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async bulkCreate(offers: Array<OfferBackEnd>): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertMany(offers);
  }

  public async create(offer: OfferBackEnd): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertOne(offer);
  }

  public async getOne(offerId: string): Promise<OfferBackEnd | null> {
    const collection = await this.getCollection();

    return await collection.findOne({ id: offerId });
  }

  public async getByAccommodation(
    accommodationId: string
  ): Promise<OfferBackEnd[]> {
    const result: OfferBackEnd[] = [];
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

  public async upsertOffer(offer: OfferBackEnd): Promise<void> {
    const collection = await this.getCollection();

    await collection.updateOne(
      { id: offer.id },
      { $set: { ...offer } },
      { upsert: true }
    );
  }

  public async getBySession(
    sessionId: string,
    requestHash: string
  ): Promise<OfferBackEnd[]> {
    const result: OfferBackEnd[] = [];
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
}

export default new OfferRepository();
