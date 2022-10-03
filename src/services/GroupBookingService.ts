import { GroupRoom } from '../types';
import {
  GroupBookingDeposits,
  GroupBookingRequest,
  GroupBookingRequestResponse,
  OfferIdAndQuantity
} from '@windingtree/glider-types/dist/win';
import { Quote } from '@windingtree/glider-types/dist/simard';
import offerRepository from '../repositories/OfferRepository';
import ApiError from '../exceptions/ApiError';
import { randomUUID } from 'crypto';
import { groupDepositPercentage } from '../config';
import Big from 'big.js';
import { convertAmount, getCurrencyDecimals } from '../utils';
import LogService from './LogService';
import { GroupQueueService } from './GroupQueueService';
import { utils } from 'ethers';

export class GroupBookingService {
  public async createGroupBookingRequest(
    bookingRequest: GroupBookingRequest
  ): Promise<GroupBookingRequestResponse> {
    const { offers, organizerInfo, invoice, guestCount, deposit } =
      bookingRequest;
    if (!offers || !organizerInfo || !invoice || !guestCount || !deposit) {
      throw ApiError.BadRequest('One field is missing in input');
    }

    // check offerIds
    const rooms: GroupRoom[] = [];
    for (const { offerId, quantity } of offers) {
      const offer = await offerRepository.getOne(offerId);
      if (!offer || !offer.expiration) {
        throw ApiError.NotFound('offer not found');
      }
      rooms.push({ quantity, offer });
    }

    if (!rooms.length) {
      throw ApiError.BadRequest('No offers in input');
    }

    // all the offers have to be in the same accommodation.
    const accommodationRef =
      rooms[0].offer.accommodation.hotelId +
      rooms[0].offer.accommodation.name +
      rooms[0].offer.accommodation.description;
    for (const room of rooms) {
      const ref =
        room.offer.accommodation.hotelId +
        room.offer.accommodation.name +
        room.offer.accommodation.description;
      if (ref !== accommodationRef) {
        throw ApiError.BadRequest('Offers must be from the same accommodation');
      }
    }

    // all the offers have to be in the same currency
    let currency = '';
    for (const room of rooms) {
      if (!currency) {
        currency = room.offer.price.currency;
        continue;
      }

      if (room.offer.price.currency !== currency) {
        throw ApiError.BadRequest("Mismatch in the offers's currencies");
      }
    }

    const requestId = randomUUID();

    // Compute the total in offerCurrency.
    let totalOfferCurrency = new Big(0);
    const offerCurrency = currency;
    for (const room of rooms) {
      totalOfferCurrency = totalOfferCurrency.plus(
        new Big(room.offer.price.public).mul(room.quantity)
      );
    }

    const totals: GroupBookingDeposits = {
      offerCurrency: {
        amount: totalOfferCurrency.toFixed(getCurrencyDecimals(offerCurrency)),
        currency: offerCurrency
      }
    };

    // Compute the total in USD.
    if (offerCurrency !== 'USD') {
      let quote: Quote;
      try {
        quote = await convertAmount(
          totals.offerCurrency.amount,
          offerCurrency,
          'USD'
        );
        if (quote.sourceAmount && quote.sourceAmount.length !== 0) {
          totals.usd = quote.sourceAmount;
        }
      } catch (e) {
        // If we don't manage to get the USD rate, we continue the flow without it.
        if (e.status !== 404 || process.env.NODE_IS_TEST !== 'true') {
          LogService.red(e);
        }
      }
    } else {
      totals.usd = totals.offerCurrency.amount;
    }

    // Compute the deposit in offerCurrency.
    const depositOptions: GroupBookingDeposits = {
      offerCurrency: {
        amount: totalOfferCurrency
          .mul(groupDepositPercentage)
          .div(100)
          .toFixed(getCurrencyDecimals(offerCurrency)),
        currency: offerCurrency
      }
    };

    // Compute the deposit in usd.
    if (totals.usd && totals.usd.length !== 0) {
      depositOptions.usd = new Big(totals.usd)
        .mul(groupDepositPercentage)
        .div(100)
        .toFixed(2);
    }

    const serviceId = computeGroupServiceId(offers);

    await GroupQueueService.getInstance().addDealJob(requestId, {
      rooms,
      contact: organizerInfo,
      invoice,
      guestsCount: guestCount,
      depositOptions,
      totals,
      requestId,
      status: 'pending',
      serviceId
    });

    return {
      requestId,
      serviceId,
      depositOptions
    };
  }
}

// TODO: move this function to the `common` library.
const computeGroupServiceId = (offers: OfferIdAndQuantity[]): string => {
  // Note: I recreate the array just to be sure that the order in object properties is respected.
  const newOffers: any[] = [];
  for (const offer of offers) {
    const obj = {};
    obj['offerId'] = offer.offerId;
    obj['quantity'] = offer.quantity;
    newOffers.push(obj);
  }
  return utils.id(JSON.stringify(newOffers));
};

export default new GroupBookingService();
