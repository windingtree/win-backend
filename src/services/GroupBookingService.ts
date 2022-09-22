import { GroupRoom } from '../types';
import { GroupBookingRequest } from '@windingtree/glider-types/dist/win';
import offerRepository from '../repositories/OfferRepository';
import ApiError from '../exceptions/ApiError';
import { randomUUID } from 'crypto';
import groupBookingRequestRepository from '../repositories/GroupBookingRequestRepository';
import GroupBookingEmailService from './GroupBookingEmailService';

export class GroupBookingService {
  public async createGroupBookingRequest(
    bookingRequest: GroupBookingRequest
  ): Promise<string> {
    const { offers, organizerInfo, invoice, guestCount, deposit } =
      bookingRequest;
    if (!offers || !organizerInfo || !invoice || !guestCount) {
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

    const requestId = randomUUID();

    // TODO: change the flow to check the poll the blockchain and check payment.

    // Store the request in database
    await groupBookingRequestRepository.createGroupBookingRequest(
      rooms,
      organizerInfo,
      invoice,
      guestCount,
      deposit,
      requestId
    );

    // TODO: create a Jira Ticket

    // Send confirmation mail
    const emailService = new GroupBookingEmailService();
    emailService.setMessage(
      rooms[0].offer.accommodation.name,
      requestId,
      organizerInfo
    );
    await emailService.sendEmail();

    return requestId;
  }
}

export default new GroupBookingService();
