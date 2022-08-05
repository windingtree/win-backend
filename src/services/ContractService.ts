import LogService from './LogService';
import { constants, providers, utils } from 'ethers';
import { WinPay__factory } from '@windingtree/win-pay/dist/typechain';
import bookingService from './BookingService';
import dealRepository from '../repositories/DealRepository';
import { DealStorage, State } from '../types';

export class ContractService {
  protected offer: any;
  protected passengers: any;
  private stopPoller: () => void;
  private contracts = [
    {
      address: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82', //todo list of contracts
      rpc: 'http://127.0.0.1:8545/',
      network: ''
    }
  ];

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
    this.contracts.forEach((contract) => {
      this.checkPaidBooking(contract).then((dealStorage) => {
        if (dealStorage) {
          bookingService.booking(offer, dealStorage, passengers);
          this.stop();
        }
      });
    });
  };

  public async checkPaidBooking(contract): Promise<null | any> {
    const { address, rpc } = contract;
    const serviceId = this.offer.id;
    const provider = new providers.JsonRpcProvider(rpc);

    if (process.env.NODE_IS_TEST === 'true') {
      const dealStorage: DealStorage = {
        asset: utils.id('some_asset'),
        customer: constants.AddressZero,
        provider: constants.AddressZero,
        state: 1,
        value: this.offer.price.public
      };
      await dealRepository.createDeal(this.offer, dealStorage, contract);
      return dealStorage;
    }

    const wipPay = WinPay__factory.connect(address, provider);
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
      await dealRepository.createDeal(this.offer, dealStorage, contract);

      if (String(this.offer.price.public) !== dealStorage.value.toString()) {
        await dealRepository.updateDealStatus(
          serviceId,
          'paymentError',
          'Invalid value of offer'
        );
        this.stop();
        return null;
      }

      // todo check for currency
      if ('JPY' !== this.offer.price.currency) {
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
