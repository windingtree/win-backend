import LogService from './LogService';
import { constants, providers, utils } from 'ethers';
import { WinPay__factory } from '@windingtree/win-pay/dist/typechain';
import bookingService from './BookingService';
import dealRepository from '../repositories/DealRepository';
import { DealStorage, State } from '../types';
import { allowedNetworks, assetsCurrencies, NetworkInfo } from '../config';

export class ContractService {
  protected offer: any;
  protected passengers: any;
  private stopPoller: () => void;

  constructor(offer, passengers: any) {
    this.offer = offer;
    this.passengers = passengers;
  }

  public start(): void {
    this.stopPoller = this.poller(this.eventListener);
  }

  public stop(): void {
    this.stopPoller();
  }

  public eventListener = async (offer: any, passengers: any) => {
    allowedNetworks.forEach((contract) => {
      this.checkPaidBooking(contract).then((dealStorage) => {
        if (dealStorage) {
          bookingService.booking(offer, dealStorage, passengers);
          this.stop();
        }
      });
    });
  };

  public async checkPaidBooking(
    contractInfo: NetworkInfo
  ): Promise<null | any> {
    if (process.env.NODE_IS_TEST === 'true') {
      const dealStorage: DealStorage = {
        asset: utils.id('some_asset'),
        customer: constants.AddressZero,
        provider: constants.AddressZero,
        state: 1,
        value: this.offer.price.public
      };
      await dealRepository.createDeal(this.offer, dealStorage, contractInfo);
      return dealStorage;
    }

    try {
      const { rpc, chainId, contracts } = contractInfo;
      const serviceId = this.offer.id;
      const provider = new providers.JsonRpcProvider(rpc, chainId);

      const wipPay = WinPay__factory.connect(contracts.winPay, provider);
      const deal = await wipPay.deals(utils.id(serviceId));

      const dealStorage: DealStorage = {
        asset: deal.asset,
        customer: deal.customer,
        provider: deal.provider,
        state: deal.state,
        value: deal.value.toString()
      };

      const statusDeal = dealStorage.state === State.PAID;

      if (statusDeal) {
        await dealRepository.createDeal(this.offer, dealStorage, contractInfo);

        if (
          utils.parseEther(this.offer.price.public.toString()).toString() !==
          dealStorage.value.toString()
        ) {
          await dealRepository.updateDealStatus(
            serviceId,
            'paymentError',
            'Invalid value of offer'
          );
          this.stop();
          return null;
        }

        if (!assetsCurrencies.includes(this.offer.price.currency)) {
          await dealRepository.updateDealStatus(
            serviceId,
            'paymentError',
            'Invalid currency of offer'
          );
          this.stop();
          return null; //todo how to rightly check value of transaction?
        }
        return dealStorage;
      }
    } catch (e) {
      console.log(e);
    }

    return null;
  }

  private poller = (fn, interval = 20000) => {
    if (typeof fn !== 'function') {
      throw new TypeError("Can't poll without a callback function");
    }
    const serviceId = this.offer.id;
    let disabled = false;
    let failures = 0;
    const poll = async () => {
      const expired = new Date() > new Date(this.offer.expiration);
      if (disabled || expired) {
        return;
      }

      try {
        await fn(this.offer, this.passengers);
      } catch (error) {
        failures++;
        LogService.red(error);
      }

      if (failures < 100) {
        setTimeout(poll, interval);
      } else {
        LogService.red(
          `Too much errors in poller for service: ${serviceId}. Disabled`
        );
      }
    };

    poll();
    LogService.green(`Poller for service: ${serviceId} started`);

    return () => {
      disabled = true;
      failures = 0;
      LogService.yellow(`Poller for service: ${serviceId} stopping`);
    };
  };
}
