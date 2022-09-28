import { GroupRoom } from '../types';
import {
  GroupBookingDeposits,
  GroupBookingRequest,
  GroupBookingRequestResponse
} from '@windingtree/glider-types/dist/win';
import { Quote } from '@windingtree/glider-types/dist/simard';
import offerRepository from '../repositories/OfferRepository';
import ApiError from '../exceptions/ApiError';
import { randomUUID } from 'crypto';
import groupBookingRequestRepository from '../repositories/GroupBookingRequestRepository';
import GroupBookingEmailService from './GroupBookingEmailService';
import JiraService from './JiraService';
import { appEnvironment, groupDepositPercentage } from '../config';
import Big from 'big.js';
import { convertAmount, getCurrencyDecimals } from '../utils';
import LogService from './LogService';
import { CreatedIssue } from 'jira.js/out/version3/models';

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

    // TODO: change the flow to poll the blockchain and check payment.
    // And with the queue, rewards will be able to check the queue to get the request information.

    // const depositOptions: GroupBookingDeposits;

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
    // If the currency is different from USD, call simard-pay.

    // Compute the total in USD.
    if (offerCurrency !== 'USD') {
      let quote: Quote;
      try {
        quote = await convertAmount(
          totals.offerCurrency.amount,
          offerCurrency,
          'USD'
        );
        if (quote.targetAmount && quote.targetAmount.length !== 0) {
          totals.usd = quote.targetAmount;
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

    // Store the request in database
    await groupBookingRequestRepository.createGroupBookingRequest(
      rooms,
      organizerInfo,
      invoice,
      guestCount,
      depositOptions,
      totals,
      requestId
    );

    // Create a Jira Ticket
    // This check is here to forbid the call to Jira in the unit tests.
    // TODO: It might be worth to do a retry here... This should be done when groups queue is in place.
    let jiraTicket: CreatedIssue;
    if (appEnvironment != 'development') {
      const jiraService = new JiraService();
      const response = await jiraService.createJiraTicket(
        rooms,
        organizerInfo,
        invoice,
        guestCount,
        depositOptions,
        totals,
        requestId
      );
      if (response) jiraTicket = response;
      // TODO: update the db record with Jira ticket
    }

    // Send confirmation mail
    if (appEnvironment != 'development') {
      const emailService = new GroupBookingEmailService();
      emailService.setMessage(
        rooms[0].offer.accommodation.name,
        requestId,
        organizerInfo
      );
      await emailService.sendEmail();
    }

    return {
      requestId,
      depositOptions
    };
  }
}

export default new GroupBookingService();
