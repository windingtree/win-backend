import {
  DealStorage,
  GroupBookingRequestDBValue,
  GroupBookingRequestStatus
} from '../types';
import { RewardType } from '@windingtree/glider-types/dist/win';
import MongoDBService from '../services/MongoDBService';
import { Collection } from 'mongodb';
import { DBName } from '../config';
import { CreatedIssue } from 'jira.js/out/version3/models';
import { NetworkInfo } from '@windingtree/win-commons/dist/types';

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

  public async createGroupBookingRequest(
    data: GroupBookingRequestDBValue
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.insertOne({
      ...data,
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

  public async updateBlockchainInfo(
    requestId: string,
    status: GroupBookingRequestStatus,
    contract: NetworkInfo,
    dealStorage: DealStorage,
    blockchainUserAddresses: string[],
    paymentCurrency: string,
    errorMessage: string
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne(
      { requestId },
      {
        $set: {
          status,
          contract,
          dealStorage,
          blockchainUserAddresses,
          paymentCurrency,
          errorMessage
        }
      }
    );
  }

  public async updateJiraInfo(
    requestId: string,
    status: GroupBookingRequestStatus,
    jiraTicket: CreatedIssue
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne({ requestId }, { $set: { status, jiraTicket } });
  }

  public async updateStatus(
    requestId: string,
    status: GroupBookingRequestStatus
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne({ requestId }, { $set: { status } });
  }

  public async updateRewardOption(
    requestId: string,
    rewardOption: RewardType
  ): Promise<void> {
    const collection = await this.getCollection();
    const res = await collection.updateOne(
      { requestId },
      { $set: { rewardOption } }
    );
    if (res.matchedCount === 0) {
      throw new Error('Deal not found');
    }
  }
}

export default new GroupBookingRequestRepository();
