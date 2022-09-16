import MongoDBService from '../services/MongoDBService';
import { DBName } from '../config';
import { OfferDbValue } from '@windingtree/glider-types/dist/win';
import { Collection } from 'mongodb';

export class OfferRepository {
  private dbService: MongoDBService;
  private collectionName = 'offers';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection(): Promise<Collection<OfferDbValue>> {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async bulkCreate(offers: Array<OfferDbValue>): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertMany(offers);
  }

  public async create(offer: OfferDbValue): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertOne(offer);
  }

  public async getOne(offerId: string): Promise<OfferDbValue | null> {
    const collection = await this.getCollection();

    return await collection.findOne({ id: offerId });
  }

  public async getByAccommodation(
    accommodationId: string
  ): Promise<OfferDbValue[]> {
    const result: OfferDbValue[] = [];
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

  public async upsertOffer(offer: OfferDbValue): Promise<void> {
    const collection = await this.getCollection();

    await collection.updateOne(
      { id: offer.id },
      { $set: { ...offer } },
      { upsert: true }
    );
  }
}

export default new OfferRepository();
