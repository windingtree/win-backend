import MongoDBService from '../services/MongoDBService';
import { Collection } from 'mongodb';
import { UserRequest, UserRequestDbData } from '../types';
import { DBName } from '../config';
import { Accommodation } from '@windingtree/glider-types/types/win';

export class UserRequestRepository {
  private dbService: MongoDBService;
  private collectionName = 'user_requests';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection(): Promise<Collection<UserRequestDbData>> {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async setRequest(userRequest: UserRequest): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertOne({
      _id: null,
      ...userRequest
    });
  }

  public async getRequestByHash(
    requestHash: string
  ): Promise<UserRequestDbData | null> {
    const collection = await this.getCollection();
    const query = { requestHash };
    const result = await collection.findOne(query);

    if (!result) {
      return null;
    }

    return result;
  }

  public async getRequestByAccommodationId(
    accommodationId: string
  ): Promise<UserRequestDbData | null> {
    const collection = await this.getCollection();
    const query = { accommodationId };
    const result = await collection.findOne(query);

    if (!result) {
      return null;
    }

    return result;
  }

  public async bulkCreate(userRequests: UserRequestDbData[]): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertMany(userRequests);
  }
}

export default new UserRequestRepository();
