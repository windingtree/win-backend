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
    try {
      const collection = await this.getCollection();
      await collection.insertOne({
        ...data,
        createdAt: new Date()
      });
    } catch (e) {
      throw new Error(`mongoDB: ${e.message}`);
    }
  }

  public async getGroupBookingRequestById(
    requestId: string
  ): Promise<GroupBookingRequestDBValue> {
    try {
      const collection = await this.getCollection();
      const bookingRequest = await collection.findOne({ requestId });
      if (!bookingRequest) {
        throw new Error('GroupBookingRequest not found');
      }
      return bookingRequest;
    } catch (e) {
      throw new Error(`mongoDB: ${e.message}`);
    }
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
    try {
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
    } catch (e) {
      throw new Error(`mongoDB: ${e.message}`);
    }
  }

  public async updateJiraInfo(
    requestId: string,
    status: GroupBookingRequestStatus,
    jiraTicket: CreatedIssue
  ): Promise<void> {
    try {
      const collection = await this.getCollection();
      await collection.updateOne(
        { requestId },
        { $set: { status, jiraTicket } }
      );
    } catch (e) {
      throw new Error(`mongoDB: ${e.message}`);
    }
  }

  public async updateStatus(
    requestId: string,
    status: GroupBookingRequestStatus
  ): Promise<void> {
    try {
      const collection = await this.getCollection();
      await collection.updateOne({ requestId }, { $set: { status } });
    } catch (e) {
      throw new Error(`mongoDB: ${e.message}`);
    }
  }

  public async updateLastError(
    requestId: string,
    lastError: Error
  ): Promise<void> {
    try {
      const collection = await this.getCollection();
      await collection.updateOne({ requestId }, { $set: { lastError } });
    } catch (e) {
      throw new Error(`mongoDB: ${e.message}`);
    }
  }

  public async updateRewardOption(
    requestId: string,
    rewardOption: RewardType
  ): Promise<void> {
    try {
      const collection = await this.getCollection();
      const res = await collection.updateOne(
        { requestId },
        { $set: { rewardOption } }
      );
      if (res.matchedCount === 0) {
        throw new Error('Deal not found');
      }
    } catch (e) {
      throw new Error(`mongoDB: ${e.message}`);
    }
  }
}

export default new GroupBookingRequestRepository();
