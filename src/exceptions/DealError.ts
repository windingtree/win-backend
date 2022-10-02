import { DealStorage } from '../types';
import { NetworkInfo } from '@windingtree/win-commons/dist/types';

export default class DealError extends Error {
  public networkInfo: NetworkInfo;
  public dealStorage: DealStorage;
  public blockchainUserAddresses: string[];
  constructor(
    message: string,
    networkInfo: NetworkInfo,
    dealStorage: DealStorage,
    blockchainUserAddresses: string[]
  ) {
    super(message);
    this.networkInfo = networkInfo;
    this.dealStorage = dealStorage;
    this.blockchainUserAddresses = blockchainUserAddresses;
  }
}
