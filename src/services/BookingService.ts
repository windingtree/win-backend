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
import LogService from './LogService';
import EmailSenderService from './EmailSenderService';
import {
  PassengerBooking,
  PassengerSearch
} from '@windingtree/glider-types/types/derbysoft';
import { DealDBValue, DealDTO, DealStorage, OfferDBValue } from '../types';

export class BookingService {
  public async booking(
    offer: OfferDBValue,
    dealStorage: DealStorage,
    passengers: { [key: string]: PassengerSearch }
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
        await dealRepository.updateDeal(
          offer.id,
          'booked',
          undefined,
          orderId,
          supplierReservationId
        );
      } else {
        await dealRepository.updateDeal(
          offer.id,
          'paymentError',
          `Booking failed by status ${order.status}`
        );
      }
    } catch (e) {
      LogService.red(e);
      await dealRepository.updateDeal(
        offer.id,
        'paymentError',
        'Booking failed' + e.message
      );
    }

    if (order.status === 'CONFIRMED') {
      const emailService = new EmailSenderService();
      emailService.setMessage(offer, passengers, supplierReservationId);
      await emailService.sendEmail();
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

    return offer.expiration.toISOString();
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
}

export default new BookingService();
