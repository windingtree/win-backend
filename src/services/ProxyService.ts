import axios from 'axios';
import { clientJwt, derbySoftProxyUrl } from '../config';
import hotelRepository from '../repositories/HotelRepository';
import { makeCircumscribedSquare } from '../utils';
import LogService from './LogService';
import offerRepository from '../repositories/OfferRepository';
import {
  Accommodation,
  SearchResponse
} from '@windingtree/glider-types/types/derbysoft';
import { DerbySoftData, Hotel, MongoLocation, OfferDBValue } from '../types';
import ApiError from '../exceptions/ApiError';

export class ProxyService {
  public async getDerbySoftOffers(body): Promise<DerbySoftData> {
    const { lon, lat, radius } = body.accommodation.location;
    const { arrival, departure } = body.accommodation;
    const rectangle = makeCircumscribedSquare(lon, lat, radius);
    body.accommodation.location = { rectangle };
    let res;
    try {
      res = await axios.post(`${derbySoftProxyUrl}/offers/search`, body, {
        headers: { Authorization: `Bearer ${clientJwt}` }
      });
    } catch (e) {
      if (e.status !== 404) {
        LogService.red(e);
      }
      return {
        data: {},
        status: e.response.status,
        message: e.response.data.error
      };
    }

    const data: SearchResponse = res.data.data;
    const accommodations = data.accommodations as {
      [key: string]: Accommodation;
    };

    const hotels = new Set<Hotel>();

    for (const [key, value] of Object.entries(accommodations)) {
      const location: MongoLocation = {
        coordinates: [
          Number(value.location?.long),
          Number(value.location?.lat)
        ],
        type: 'Point'
      };
      const hotel = {
        ...value,
        id: key,
        provider: 'derbySoft',
        createdAt: new Date(),
        location
      } as Hotel;

      hotels.add(hotel);
    }

    await hotelRepository.bulkCreate(Array.from(hotels));

    const sortedHotels = await hotelRepository.searchByRadius(
      lon,
      lat,
      radius,
      Object.keys(accommodations)
    );

    const { offers } = res.data.data;

    const offersSet = new Set<OfferDBValue>();

    Object.keys(offers).map((k) => {
      const offer = offers[k];
      const { pricePlansReferences } = offer;
      const { roomType } =
        pricePlansReferences[Object.keys(pricePlansReferences)[0]];

      const accommodation = {
        ...sortedHotels.find(
          (v) =>
            v.id ===
            pricePlansReferences[Object.keys(pricePlansReferences)[0]]
              .accommodation
        )
      } as Hotel;

      if (accommodation.roomTypes && accommodation.roomTypes[roomType]) {
        accommodation.roomTypes = {
          [roomType]: accommodation.roomTypes[roomType]
        };
      }

      const offerDBValue: OfferDBValue = {
        id: k,
        accommodation,
        arrival,
        departure,
        expiration: new Date(offer.expiration)
      };

      offersSet.add(offerDBValue);
    });

    await offerRepository.bulkCreate(Array.from(offersSet));

    const sortedAccommodations: {
      [key: string]: Accommodation;
    } = {};

    sortedHotels.forEach((hotel: Hotel) => {
      sortedAccommodations[hotel.id] = accommodations[hotel.id];
    });

    data.accommodations = sortedAccommodations;

    return {
      data,
      status: res.data.status
    };
  }

  public async getDerbySoftOfferPrice(offerId: string): Promise<DerbySoftData> {
    let res;
    try {
      res = await axios.post(
        `${derbySoftProxyUrl}/offers/${offerId}/price`,
        {},
        {
          headers: { Authorization: `Bearer ${clientJwt}` }
        }
      );
    } catch (e) {
      if (e.status !== 404) {
        LogService.red(e);
      }
      return {
        data: {},
        status: e.response.status,
        message: e.response.data.error
      };
    }

    const offer = await offerRepository.getOne(offerId);

    if (!offer) {
      throw ApiError.NotFound('offer not found');
    }

    const { data } = res.data;
    const expiration = new Date(data.offer.expiration);

    const offerDBValue: OfferDBValue = {
      arrival: offer.arrival,
      departure: offer.departure,
      id: data.offerId,
      accommodation: offer.accommodation,
      expiration: expiration,
      pricedItems: data.offer.pricedItems,
      disclosures: data.offer.disclosures,
      price: data.offer.price
    };

    await offerRepository.create(offerDBValue);

    data.accommodation = {
      ...offer.accommodation,
      _id: offer.accommodation._id?.toString()
    };

    return {
      data: data,
      status: 'success'
    };
  }
}

export default new ProxyService();
