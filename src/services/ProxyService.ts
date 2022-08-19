import axios from 'axios';
import { clientJwt, getUrlByKey } from '../config';
import hotelRepository from '../repositories/HotelRepository';
import { makeCircumscribedSquare } from '../utils';
import LogService from './LogService';
import offerRepository from '../repositories/OfferRepository';
import {
  Accommodation,
  SearchCriteria,
  SearchResponse
} from '@windingtree/glider-types/types/derbysoft';
import {
  DerbySoftData,
  Hotel,
  HotelProviders,
  MongoLocation,
  OfferDBValue,
  SearchBody
} from '../types';
import ApiError from '../exceptions/ApiError';
import { utils } from 'ethers';

export class ProxyService {
  public async getDerbySoftOffers(
    body: SearchBody,
    provider: HotelProviders
  ): Promise<DerbySoftData> {
    const { lon, lat, radius } = body.accommodation.location;
    const { arrival, departure } = body.accommodation;
    const rectangle = makeCircumscribedSquare(lon, lat, radius);

    const resBody: SearchCriteria = {
      ...body,
      accommodation: {
        ...body.accommodation,
        location: { rectangle }
      }
    };
    const url = getUrlByKey(provider);

    let res;
    try {
      res = await axios.post(`${url}/offers/search`, resBody, {
        headers: { Authorization: `Bearer ${clientJwt}` }
      });
    } catch (e) {
      if (e.status !== 404) {
        LogService.red(e);
      }
      return {
        data: null,
        status: String(e.response.status),
        message: e.response.data.error
      };
    }

    const data: SearchResponse = res.data;

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
        provider: provider,
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

    const { offers } = data;

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

      offer.price = {
        currency: offer.price.currency,
        private: offer.price.private ? String(offer.price.priva) : undefined,
        public: String(offer.price.public),
        commission: offer.price.commission
          ? String(offer.price.commission)
          : undefined,
        taxes: offer.price.taxes ? String(offer.price.taxes) : undefined,
        isAmountBeforeTax: offer.price.isAmountBeforeTax,
        decimalPlaces: offer.price.decimalPlaces
      };

      const offerDBValue: OfferDBValue = {
        id: k,
        accommodation,
        arrival: new Date(arrival),
        departure: new Date(departure),
        expiration: new Date(offer.expiration),
        price: offer.price,
        provider
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
      status: 'success'
    };
  }

  public async getDerbySoftOfferPrice(offerId: string): Promise<DerbySoftData> {
    const offer = await offerRepository.getOne(offerId);

    if (!offer) {
      throw ApiError.NotFound('offer not found');
    }

    const url = getUrlByKey(offer.provider);

    let res;
    try {
      res = await axios.post(
        `${url}/offers/${offerId}/price`,
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
        data: null,
        status: e.response.status,
        message: e.response.data.error
      };
    }

    const { data } = res;
    const expiration = new Date(data.offer.expiration);

    data.offer.price = {
      currency: data.offer.price.currency,
      private: data.offer.price.private
        ? String(data.offer.price.priva)
        : undefined,
      public: String(data.offer.price.public),
      commission: data.offer.price.commission
        ? String(data.offer.price.commission)
        : undefined,
      taxes: data.offer.price.taxes
        ? String(data.offer.price.taxes)
        : undefined,
      isAmountBeforeTax: data.offer.price.isAmountBeforeTax,
      decimalPlaces: data.offer.price.decimalPlaces
    };

    for (const item of data.offer.pricedItems) {
      item.fare.forEach((fare) => {
        fare.amount = String(fare.amount);
      });

      item.taxes.forEach((tax) => {
        tax.amount = String(tax.amount);
      });
    }

    //todo remove after derby and amadeus proxy fix types

    const offerDBValue: OfferDBValue = {
      arrival: offer.arrival,
      departure: offer.departure,
      id: data.offerId,
      accommodation: offer.accommodation,
      expiration: expiration,
      pricedItems: data.offer.pricedItems,
      disclosures: data.offer.disclosures,
      price: data.offer.price,
      provider: offer.provider
    };

    await offerRepository.create(offerDBValue);

    data.accommodation = {
      ...offer.accommodation,
      _id: offer.accommodation._id?.toString()
    };

    data.serviceId = utils.id(data.offerId);
    data.provider = utils.keccak256(
      utils.formatBytes32String('win_win_provider')
    );

    return {
      data,
      status: 'success'
    };
  }
}

export default new ProxyService();
