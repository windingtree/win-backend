import MongoDBService from '../services/MongoDBService';
import { Collection } from 'mongodb';
import { SessionDbData } from '../types';
import { DBName, sessionTokenMaxAge } from '../config';
import { DateTime } from 'luxon';

export class SessionRepository {
  private dbService: MongoDBService;
  private collectionName = 'sessions';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection(): Promise<Collection<SessionDbData>> {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  public async setSession(
    uuid: string,
    ip: string,
    userAgent: string
  ): Promise<void> {
    const collection = await this.getCollection();

    await collection.insertOne({
      _id: null,
      uuid,
      ip,
      userAgent,
      expiredAt: new Date(
        DateTime.now().plus({ millisecond: sessionTokenMaxAge }).toISO()
      )
    });
  }

  public async getSession(uuid: string): Promise<SessionDbData | null> {
    const collection = await this.getCollection();
    const query = { uuid };
    const result = await collection.findOne(query);

    if (!result) {
      return null;
    }

    return result;
  }
}

export default new SessionRepository();
