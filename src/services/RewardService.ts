import axios from 'axios';
import {
  rewardPercentage,
  coinGeckoURL,
  tokenPrecision,
  tco2Precision
} from '../config';
import { RewardOption, RewardType } from '@windingtree/glider-types/dist/win';
import ApiError from '../exceptions/ApiError';
import dealRepository from '../repositories/DealRepository';
import groupBookingRequestRepository from '../repositories/GroupBookingRequestRepository';
import offerRepository from '../repositories/OfferRepository';
import { OfferBackEnd, GroupBookingRequestDBValue } from '../types';
import { GroupQueueService } from './GroupQueueService';
import { RewardQueueService } from './RewardQueueService';

const options = {
  LIF: {
    id: 'winding-tree',
    symbol: 'lif',
    name: 'Lif'
  },
  NCT: {
    id: 'toucan-protocol-nature-carbon-tonne',
    symbol: 'nct',
    name: 'Toucan Protocol: Nature Carbon Tonne'
  }
};

export class RewardService {
  public async getOptions(offerId: string): Promise<RewardOption[]> {
    let offer: OfferBackEnd | null;
    try {
      offer = await offerRepository.getOne(offerId);
      if (!offer) {
        const deal = await dealRepository.getDeal(offerId);
        if (!deal.offer) {
          throw ApiError.NotFound('offer not found in deal');
        }
        offer = deal.offer;
      }

      if (!offer.price.public || !offer.price.currency) {
        throw ApiError.NotFound('offer price not found');
      }
    } catch (e) {
      throw ApiError.NotFound('Issue when retrieving offer: ' + e);
    }

    const priceOffer = offer.price.public;
    const currencyOffer = offer.price.currency;

    const rewardValue = (Number(priceOffer) * rewardPercentage) / 100;
    return this.generateOptions(rewardValue, currencyOffer);
  }

  public async updateOption(
    offerId: string,
    rewardOption: RewardType
  ): Promise<boolean> {
    let offer: OfferBackEnd | null;
    try {
      // TODO: here we should check the queue instead of the offer db.
      offer = await offerRepository.getOne(offerId);
      if (!offer) {
        const deal = await dealRepository.getDeal(offerId);
        if (!deal.offer) {
          throw ApiError.NotFound('offer not found in deal');
        }
        offer = deal.offer;
      }
    } catch (e) {
      throw ApiError.NotFound('Issue when retrieving offer: ' + e);
    }

    RewardQueueService.getInstance().addRewardJob(offerId, {
      dealType: 'Standard',
      id: offerId,
      rewardType: rewardOption
    });
    return true;
  }

  private async generateOptions(
    rewardValue: number,
    currency: string
  ): Promise<RewardOption[]> {
    let priceNCT: number, priceLIF: number;
    try {
      const res = await axios.get(
        `${coinGeckoURL}/simple/price?ids=${options.LIF.id},${
          options.NCT.id
        }&vs_currencies=${currency.toLowerCase()}`
      );
      // {
      //     "toucan-protocol-nature-carbon-tonne": {
      //       "usd": 2.12
      //     },
      //     "winding-tree": {
      //       "usd": 0.02052527
      //     }
      // }

      priceNCT = res.data[options.NCT.id][currency.toLowerCase()];
      priceLIF = res.data[options.LIF.id][currency.toLowerCase()];
    } catch (e) {
      throw ApiError.NotFound(`Price of the reward not found`);
    }

    if (!priceNCT || !priceLIF) {
      // TODO: a bad gateway error would be better here.
      throw ApiError.NotFound(`Price of the reward not found`);
    }

    const qtyNCT = rewardValue / priceNCT;
    // Note: update these numbers when moon
    let qtyLIF = Math.round(rewardValue / priceLIF / 100) * 100; // LIF is rounded to the hundreds.
    if (qtyLIF === 0) {
      qtyLIF = 100;
    }

    return [
      {
        rewardType: 'CO2_OFFSET',
        tokenName: 'NCT',
        quantity: qtyNCT.toFixed(tco2Precision)
      },
      {
        rewardType: 'TOKEN',
        tokenName: 'LIF',
        quantity: qtyLIF.toFixed(tokenPrecision)
      }
    ];
  }

  public async retrieveGroupRecord(
    requestId: string
  ): Promise<GroupBookingRequestDBValue> {
    // Check the queue first.
    let record: GroupBookingRequestDBValue | undefined;
    try {
      record = await GroupQueueService.getInstance().getDealJob(requestId);
    } catch (e) {
      // Check the db if not in queue.
      try {
        record = await groupBookingRequestRepository.getGroupBookingRequestById(
          requestId
        );
      } catch (e) {
        throw ApiError.NotFound('Rewards: group booking request not found');
      }
    }

    // Just in case...
    if (!record) {
      throw ApiError.NotFound('Rewards: group booking request not found');
    }

    return record;
  }

  public async getGroupOptions(requestId: string): Promise<RewardOption[]> {
    const record = await this.retrieveGroupRecord(requestId);

    let total = '';
    let currency = '';
    // We prefer the USD amount to limit conversion issues in coinGecko API.
    if (record.totals.usd && record.totals.usd.length !== 0) {
      total = record.totals.usd;
      currency = 'USD';
    } else {
      total = record.totals.offerCurrency.amount;
      currency = record.totals.offerCurrency.currency;
    }

    // apply the percentage (precision does not matter here)
    const rewardValue = (Number(total) * rewardPercentage) / 100;

    return this.generateOptions(rewardValue, currency);
  }

  public async updateGroupOption(
    requestId: string,
    rewardOption: RewardType
  ): Promise<boolean> {
    // Check existence of the group request.
    await this.retrieveGroupRecord(requestId);

    // Here we use a dedicated queue for the update because the booking might still be in the queue, and in a transitory state
    // and we don't know for how long.
    RewardQueueService.getInstance().addRewardJob(requestId, {
      dealType: 'Group',
      id: requestId,
      rewardType: rewardOption
    });
    return true;
  }
}

export default new RewardService();
