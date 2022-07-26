import LogService from './LogService';
import { constants, providers, utils, BigNumber as BN } from 'ethers';
import { WinPay__factory } from '@windingtree/win-pay/dist/typechain';
import bookingService from './BookingService';
import dealRepository from '../repositories/DealRepository';
import { DealStorage, OfferBackEnd, State } from '../types';
import { allowedNetworks, getNetworkInfo, testWallet } from '../config';
import { PassengerBooking } from '@windingtree/glider-types/dist/accommodations';
import { getOwners } from '@windingtree/win-commons/dist/multisig';
import { NetworkInfo } from '@windingtree/win-commons/dist/types';
import { QueueService } from './QueueService';
import { Job } from 'bullmq';
import { getContractServiceId } from '../utils';
import { DateTime } from 'luxon';

export class ContractService {
  protected offer: OfferBackEnd;
  protected passengers: { [key: string]: PassengerBooking };
  private stopPoller: () => void;
  protected job: Job;

  constructor(offer, passengers: { [key: string]: PassengerBooking }) {
    this.offer = offer;
    this.passengers = passengers;
  }

  public start(): void {
    this.stopPoller = this.poller(this.eventListener);
  }

  public stop(): void {
    this.stopPoller();
  }

  public eventListener = async (
    offer: OfferBackEnd,
    passengers: { [key: string]: PassengerBooking }
  ) => {
    allowedNetworks.forEach((contract) => {
      this.checkPaidBooking(contract)
        .then((dealStorage) => {
          if (dealStorage) {
            bookingService.booking(offer, dealStorage, passengers);
            this.stop();
          }
        })
        .catch(async (e) => {
          if (process.env.NODE_IS_TEST !== 'true') {
            console.log(e);
            await dealRepository.updateDeal(this.offer.id, 'serverError', e);
          }
        });
    });
  };

  public async checkPaidBooking(
    contractInfo: NetworkInfo
  ): Promise<null | DealStorage> {
    const { rpc, chainId, contracts } = contractInfo;
    const provider = new providers.JsonRpcProvider(rpc, chainId);

    const price = String(this.offer.price.public);

    if (process.env.NODE_IS_TEST === 'true') {
      const dealStorage: DealStorage = {
        asset: utils.id('some_asset'),
        customer: (await testWallet).address,
        provider: constants.AddressZero,
        state: 1,
        value: price
      };
      await dealRepository.createDeal(
        this.offer,
        dealStorage,
        contractInfo,
        await getOwners(dealStorage.customer, provider)
      );
      return dealStorage;
    }

    try {
      const serviceId = this.offer.id;

      const wipPay = WinPay__factory.connect(contracts.winPay, provider);
      const deal = await wipPay.deals(getContractServiceId(serviceId));

      const dealStorage: DealStorage = {
        asset: deal.asset,
        customer: deal.customer,
        provider: deal.provider,
        state: deal.state,
        value: deal.value.toString()
      };

      if (dealStorage.state === State.PAID) {
        await dealRepository.createDeal(
          this.offer,
          dealStorage,
          contractInfo,
          await getOwners(dealStorage.customer, provider)
        );

        await QueueService.getInstance().addDealJob(serviceId, {
          id: serviceId,
          passengers: this.passengers,
          startTime: DateTime.now()
        });

        const network = getNetworkInfo(chainId);
        const address = utils.getAddress(dealStorage.asset);
        const asset = network.contracts.assets.find(
          (asset) => utils.getAddress(asset.coin) === address
        );

        if (!asset) {
          await dealRepository.updateDeal(
            serviceId,
            'paymentValidationError',
            `Asset with coin address ${address} not found`
          );
          this.stop();
          return null;
        }

        if (!['USD', this.offer.price.currency].includes(asset.currency)) {
          await dealRepository.updateDeal(
            serviceId,
            'paymentValidationError',
            'Invalid currency of offer'
          );
          this.stop();
          return null;
        }

        const dealValue = BN.from(dealStorage.value);

        if (dealValue.eq(utils.parseUnits(price, asset.decimals))) {
          if (asset.currency !== this.offer.price.currency) {
            await dealRepository.updateDeal(
              serviceId,
              'paymentValidationError',
              `Invalid payment currency: ${this.offer.price.currency} while expected ${asset.currency}`
            );
            this.stop();
            return null;
          }
        } else if (
          this.offer.quote &&
          dealValue.eq(
            utils.parseUnits(
              String(this.offer.quote.sourceAmount),
              asset.decimals
            )
          )
        ) {
          if (asset.currency !== this.offer.quote.sourceCurrency) {
            await dealRepository.updateDeal(
              serviceId,
              'paymentValidationError',
              'Invalid payment currency'
            );
            this.stop();
            return null;
          }
        } else {
          await dealRepository.updateDeal(
            serviceId,
            'paymentValidationError',
            'Invalid value of offer'
          );
          this.stop();
          return null;
        }

        return dealStorage;
      }
    } catch (e) {
      console.log(e);
    }

    return null;
  }

  private poller = (fn, interval = 5000) => {
    if (typeof fn !== 'function') {
      throw new TypeError("Can't poll without a callback function");
    }
    const serviceId = this.offer.id;
    let disabled = false;
    let failures = 0;
    const poll = async () => {
      const expired =
        this.offer.expiration && new Date() > new Date(this.offer.expiration);
      if (disabled || expired) {
        await this.job.remove();
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

    QueueService.getInstance()
      .addContractJob(this.offer.id, {
        id: this.offer.id,
        passengers: this.passengers,
        startTime: DateTime.now()
      })
      .then((job) => {
        if (job) {
          this.job = job;
        }
      });

    poll();
    LogService.green(`Poller for service: ${serviceId} started`);

    return () => {
      disabled = true;
      failures = 0;
      LogService.yellow(`Poller for service: ${serviceId} stopping`);
    };
  };
}
