import { GroupBookingRequestDBValue, GroupRoom } from '../types';
import {
  GroupBookingDeposit,
  OrganizerInformation
} from '@windingtree/glider-types/dist/win';
import MongoDBService from '../services/MongoDBService';
import { Collection } from 'mongodb';
import { DBName } from '../config';

export class GroupBookingRequestRepository {
  private dbService: MongoDBService;
  private collectionName = 'groupBookingRequests';

  constructor() {
    this.dbService = MongoDBService.getInstance();
  }

  protected async getCollection(): Promise<
    Collection<GroupBookingRequestDBValue>
  > {
    const dbClient = await this.dbService.getDbClient();
    const database = dbClient.db(DBName);

    return database.collection(this.collectionName);
  }

  // TODO: add smart contract info
  public async createGroupBookingRequest(
    rooms: GroupRoom[],
    contact: OrganizerInformation,
    invoice: boolean,
    guestsCount: number,
    deposit: GroupBookingDeposit,
    requestId: string
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.insertOne({
      contact,
      rooms,
      invoice,
      requestId,
      guestsCount,
      deposit,
      status: 'paid',
      createdAt: new Date()
    });
  }

  public async getGroupBookingRequestById(
    requestId: string
  ): Promise<GroupBookingRequestDBValue> {
    const collection = await this.getCollection();
    const bookingRequest = await collection.findOne({ requestId });
    if (!bookingRequest) {
      throw new Error('GroupBookingRequest not found');
    }
    return bookingRequest;
  }

  // Used for tests
  public async getGroupBookingRequestByName(
    firstName: string,
    lastName: string
  ): Promise<Array<GroupBookingRequestDBValue>> {
    const collection = await this.getCollection();
    const bookingRequest = await collection.find({
      'contact.firstName': firstName,
      'contact.lastName': lastName
    });
    if (!bookingRequest) {
      throw new Error('GroupBookingRequest not found');
    }
    return bookingRequest.toArray();
  }
}

export default new GroupBookingRequestRepository();
