import axios from 'axios';
import {
  clientJwt,
  derbySoftProxyUrl,
  getUrlByKey,
  simardJwt,
  simardOrgId,
  simardUrl
} from '../config';
import dealRepository from '../repositories/DealRepository';
import offerRepository from '../repositories/OfferRepository';
import ApiError from '../exceptions/ApiError';
import { ContractService } from './ContractService';
import EmailSenderService from './EmailSenderService';
import { PassengerBooking } from '@windingtree/glider-types/dist/accommodations';
import { DealDBValue, DealDTO, DealStorage, OfferBackEnd } from '../types';
import { parseEmailAddress } from '../utils';
import { QueueService } from './QueueService';

export class BookingService {
  public async booking(
    offer: OfferBackEnd,
    dealStorage: DealStorage,
    passengers: { [key: string]: PassengerBooking }
  ): Promise<boolean> {
    const data = {
      currency: offer.price?.currency,
      amount: String(offer.price?.public),
      receiverOrgId: simardOrgId,
      customerReferences: {
        travellerLastName: '-',
        travellerFirstName: '-'
      }
    };

    await dealRepository.updateDeal(offer.id, 'pending');

    const travelAccount = await axios.post(
      `${simardUrl}/tokens/travel-account`,
      data,
      {
        headers: { Authorization: `Bearer ${simardJwt}` }
      }
    );

    const orderData = {
      offerId: offer.id,
      guaranteeId: travelAccount.data.id,
      passengers
    };

    const url = getUrlByKey(offer.provider);

    let order;
    let orderId;
    let supplierReservationId;
    try {
      const orderReq = await axios.post(
        `${url}/orders/createWithOffer`,
        orderData,
        {
          headers: { Authorization: `Bearer ${clientJwt}` }
        }
      );
      order = orderReq.data.order;
      if (order.status === 'CONFIRMED') {
        orderId = orderReq.data.orderId;
        supplierReservationId = orderReq.data.supplierReservationId;

        // TODO: passengers info should be checked before in the flow
        const emailAddress = parseEmailAddress(passengers);

        await dealRepository.updateDeal(
          offer.id,
          'booked',
          undefined,
          orderId,
          supplierReservationId,
          emailAddress
        );

        const emailService = new EmailSenderService();
        emailService.setMessage(offer, passengers, supplierReservationId);
        await emailService.sendEmail();
      } else {
        await dealRepository.updateDeal(
          offer.id,
          'paymentError',
          `Booking failed by status ${order.status}`
        );
      }
    } catch (e) {
      if (process.env.NODE_IS_TEST !== 'true') {
        console.log(e);
      }
      await dealRepository.updateDeal(
        offer.id,
        'paymentError',
        'Booking failed' + e.message
      );
    }

    return true;
  }

  public async cancelOrder(orderId) {
    return await axios.delete(`${derbySoftProxyUrl}/orders/${orderId}`);
  }

  public async myBookings(address: string): Promise<DealDTO[]> {
    const deals = await dealRepository.getUserDeals(address);
    return this.getDealsDTO(deals);
  }

  public async setPassengers(
    offerId: string,
    passengers: PassengerBooking[]
  ): Promise<string> {
    const offer = await offerRepository.getOne(offerId);

    const passengersMap = {};

    passengers.forEach((value, key) => {
      passengersMap[`PAX${key + 1}`] = value;
    });

    if (!offer || !offer.expiration) {
      throw ApiError.NotFound('offer not found');
    }

    new ContractService(offer, passengersMap).start();

    return new Date(offer.expiration).toISOString();
  }

  getDealsDTO(deals: DealDBValue[]): DealDTO[] {
    const dealsDTO = new Set<DealDTO>();

    deals.forEach((value) => {
      dealsDTO.add({
        createdAt: value.createdAt,
        message: value.message,
        offer: value.offer,
        offerId: value.offerId,
        orderId: value.orderId,
        status: value.status,
        supplierReservationId: value.supplierReservationId,
        rewardOption: value.rewardOption
      });
    });

    return Array.from(dealsDTO);
  }

  public async checkFailedDeal(
    offerId: string,
    passengers: { [key: string]: PassengerBooking }
  ): Promise<void> {
    const deal = await dealRepository.getDeal(offerId);

    if (
      ['booked', 'transactionError', 'creationFailed', 'cancelled'].includes(
        deal.status
      )
    ) {
      return;
    }

    //create similar job for check one more time
    await QueueService.getInstance().addDealJob(offerId, {
      id: offerId,
      passengers
    });

    const url = getUrlByKey(deal.offer.provider);
    let orderId;
    let supplierReservationId;

    try {
      const orderReq = await axios.get(`${url}/orders`, {
        params: {
          offerId: offerId
        },
        headers: { Authorization: `Bearer ${clientJwt}` }
      });
      const emailAddress = parseEmailAddress(passengers);
      if (orderReq.data.order.status === 'CONFIRMED') {
        orderId = orderReq.data.orderId;
        supplierReservationId = orderReq.data.supplierReservationId;

        await dealRepository.updateDeal(
          deal.offer.id,
          'booked',
          undefined,
          orderId,
          supplierReservationId,
          emailAddress
        );

        const emailService = new EmailSenderService();
        emailService.setMessage(deal.offer, passengers, supplierReservationId);
        await emailService.sendEmail();
      }

      if (orderReq.data.order.status === 'CREATION_FAILED') {
        await dealRepository.updateDeal(
          deal.offer.id,
          'creationFailed',
          'Proxy side creation failed'
        );
      }

      if (orderReq.data.order.status === 'CANCELLED') {
        await dealRepository.updateDeal(
          deal.offer.id,
          'cancelled',
          'Proxy side cancelled'
        );
      }

      return;
    } catch (e) {
      if (e.response.data.code === 400) {
        await this.booking(deal.offer, deal.dealStorage, passengers);
      } else {
        console.log(e);
      }
    }
  }
}

export default new BookingService();
