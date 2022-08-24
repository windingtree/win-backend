import axios from 'axios';
import { RewardOption, RewardTypes } from 'src/types';
import offerRepository from '../repositories/OfferRepository';
import ApiError from '../exceptions/ApiError';
import dealRepository from '../repositories/DealRepository';

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

const rewardPercentage = 6;

// Note: Free API is limited to 50 calls/minute.
const apiURL = 'https://api.coingecko.com/api/v3/';
const coinGeckoQuoteCurrencies = [
  'btc',
  'eth',
  'ltc',
  'bits',
  'bch',
  'bnb',
  'eos',
  'xrp',
  'xlm',
  'link',
  'dot',
  'yfi',
  'usd',
  'aed',
  'ars',
  'aud',
  'bdt',
  'bhd',
  'bmd',
  'brl',
  'cad',
  'chf',
  'clp',
  'cny',
  'czk',
  'dkk',
  'eur',
  'gbp',
  'hkd',
  'huf',
  'idr',
  'ils',
  'inr',
  'jpy',
  'krw',
  'kwd',
  'lkr',
  'mmk',
  'mxn',
  'myr',
  'ngn',
  'nok',
  'nzd',
  'php',
  'pkr',
  'pln',
  'rub',
  'sar',
  'sek',
  'sgd',
  'thb',
  'try',
  'twd',
  'uah',
  'vef',
  'vnd',
  'zar',
  'xdr',
  'xag',
  'xau',
  'sats'
];

export class RewardService {
  public async getOptions(offerId: string): Promise<RewardOption[]> {
    const offer = await offerRepository.getOne(offerId);
    const priceOffer = offer?.price?.public;
    const currencyOffer = offer?.price?.currency;

    if (!currencyOffer || !priceOffer) {
      throw ApiError.NotFound('offer not found');
    }

    if (!coinGeckoQuoteCurrencies.includes(currencyOffer.toLowerCase())) {
      throw ApiError.NotFound('currency not supported in price API');
    }

    const rewardValue = (Number(priceOffer) * rewardPercentage) / 100;

    let priceNCT, priceLIF;
    try {
      const res = await axios.get(
        `${apiURL}/simple/price?ids=${options.LIF.id},${
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

      priceNCT = Number(res.data[options.NCT.id][currencyOffer.toLowerCase()]);
      priceLIF = Number(res.data[options.LIF.id][currencyOffer.toLowerCase()]);
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
        quantity: qtyNCT.toFixed(1)
      },
      {
        rewardType: 'TOKEN',
        tokenName: 'LIF',
        quantity: qtyLIF.toFixed(0)
      }
    ];
  }

  public async updateOptions(
    offerId: string,
    rewardOption: RewardTypes
  ): Promise<boolean> {
    if (!rewardOption) {
      throw ApiError.BadRequest('rewardOption is undefined');
    }

    await dealRepository.updateRewardOption(offerId, rewardOption);

    return true;
  }
}

export default new RewardService();

// curl -X 'GET' \
//   'https://api.coingecko.com/api/v3/simple/price?ids=winding-tree&vs_currencies=usd' \
//   -H 'accept: application/json'

// {
//     "winding-tree": {
//       "usd": 0.02052527
//     }
// }

// curl -X 'GET' \
//   'https://api.coingecko.com/api/v3/simple/price?ids=toucan-protocol-nature-carbon-tonne&vs_currencies=usd' \
//   -H 'accept: application/json'

// {
//     "toucan-protocol-nature-carbon-tonne": {
//       "usd": 2.14
//     }
// }
