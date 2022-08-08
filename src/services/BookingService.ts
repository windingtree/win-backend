import axios from 'axios';
import {
  clientJwt,
  derbySoftProxyUrl,
  simardJwt,
  simardOrgId,
  simardUrl
} from '../config';
import dealRepository from '../repositories/DealRepository';
import offerRepository from '../repositories/OfferRepository';
import ApiError from '../exceptions/ApiError';
import { ContractService } from './ContractService';
import LogService from './LogService';

export class BookingService {
  public async booking(offer: any, dealStorage: any, passengers: any) {
    const data = {
      currency: offer.price.currency,
      amount: String(offer.price.public),
      receiverOrgId: simardOrgId,
      customerReferences: {
        travellerLastName: '-',
        travellerFirstName: '-'
      }
    };

    await dealRepository.updateDealStatus(offer.id, 'pending', null);

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

    let order;
    try {
      const orderReq = await axios.post(
        `${derbySoftProxyUrl}/orders/createWithOffer`,
        orderData,
        {
          headers: { Authorization: `Bearer ${clientJwt}` }
        }
      );
      order = orderReq.data.data;

      if (order.order.status === 'CONFIRMED') {
        await dealRepository.updateDealStatus(offer.id, 'booked', null);
      } else {
        await dealRepository.updateDealStatus(
          offer.id,
          'paymentError',
          `Booking failed by status ${order.order.status}`
        );
      }
    } catch (e) {
      LogService.red(e);
      await dealRepository.updateDealStatus(
        offer.id,
        'paymentError',
        'Booking failed'
      );
    }

    return true;
  }

  public async cancelOrder(orderId) {
    const retrieveOrder = await axios.delete(
      `${derbySoftProxyUrl}/orders/${orderId}`
    );

    return true;
  }

  public async myBookings(address: string) {
    return dealRepository.getUserDeals(address);
  }

  public async setPassengers(offerId: string, passengers: any[]) {
    const offer = await offerRepository.getOne(offerId);

    const passengersMap = {};

    passengers.forEach((value, key) => {
      passengersMap[`PAX${key + 1}`] = value;
    });

    if (!offer) {
      throw ApiError.NotFound('offer not found');
    }

    new ContractService(offer, passengersMap).start();

    return offer.expiration;
  }
}

export default new BookingService();
