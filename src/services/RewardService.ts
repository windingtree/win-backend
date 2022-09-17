import axios from 'axios';
import {
  rewardPercentage,
  coinGeckoURL,
  tokenPrecision,
  tco2Precision
} from '../config';
import {
  RewardOption,
  RewardType,
  OfferDbValue
} from '@windingtree/glider-types/dist/win';
import ApiError from '../exceptions/ApiError';
import dealRepository from '../repositories/DealRepository';
import offerRepository from '../repositories/OfferRepository';

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
    let offer: OfferDbValue | null;
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

    let priceNCT: number, priceLIF: number;
    try {
      const res = await axios.get(
        `${coinGeckoURL}/simple/price?ids=${options.LIF.id},${
          options.NCT.id
        }&vs_currencies=${currencyOffer.toLowerCase()}`
      );
      // {
      //     "toucan-protocol-nature-carbon-tonne": {
      //       "usd": 2.12
      //     },
      //     "winding-tree": {
      //       "usd": 0.02052527
      //     }
      // }

      priceNCT = res.data[options.NCT.id][currencyOffer.toLowerCase()];
      priceLIF = res.data[options.LIF.id][currencyOffer.toLowerCase()];
    } catch (e) {
      throw ApiError.NotFound(`Price of the reward not found`);
    }

    if (!priceNCT || !priceLIF) {
      // TODO: a bad gateway error would be better here.
      throw ApiError.NotFound(`Price of the reward not found`);
    }

    const qtyNCT = rewardValue / priceNCT;
    const qtyLIF = Math.round(rewardValue / priceLIF / 100) * 100; // LIF is rounded to the hundreds.

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

  public async updateOption(
    offerId: string,
    rewardOption: RewardType
  ): Promise<boolean> {
    try {
      await dealRepository.getDeal(offerId);
    } catch (e) {
      throw ApiError.NotFound('deal not found');
    }

    await dealRepository.updateRewardOption(offerId, rewardOption);

    return true;
  }
}

export default new RewardService();
