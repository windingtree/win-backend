import { GroupBookingRequestDBValue, GroupRoom } from '../types';
import {
  GroupBookingDeposits,
  OrganizerInformation,
  RewardType
} from '@windingtree/glider-types/dist/win';
import MongoDBService from '../services/MongoDBService';
import { Collection } from 'mongodb';
import { DBName } from '../config';
import { CreatedIssue } from 'jira.js/out/version3/models';

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
    depositOptions: GroupBookingDeposits,
    totals: GroupBookingDeposits,
    requestId: string
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.insertOne({
      contact,
      rooms,
      invoice,
      requestId,
      guestsCount,
      totals,
      depositOptions,
      status: 'pending',
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

  public async updateRewardOption(
    requestId: string,
    rewardOption: RewardType
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne({ requestId }, { $set: { rewardOption } });
  }
}

export default new GroupBookingRequestRepository();
