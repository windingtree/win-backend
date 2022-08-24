import axios, { AxiosResponse } from 'axios';
import { clientJwt, getUrlByKey, providersUrls } from '../config';
import hotelRepository from '../repositories/HotelRepository';
import { makeCircumscribedSquare } from '../utils';
import LogService from './LogService';
import offerRepository from '../repositories/OfferRepository';
import {
  SearchCriteria,
  SearchResponse
} from '@windingtree/glider-types/types/derbysoft';
import { HotelProviders, OfferDBValue, SearchBody } from '../types';
import ApiError from '../exceptions/ApiError';
import { utils } from 'ethers';
import {
  Accommodation,
  Location,
  PricedOffer,
  SearchResults
} from '@windingtree/glider-types/types/win';
import { assetsCurrencies } from '@windingtree/win-commons/dist/types';

export class ProxyService {
  public async getDerbySoftOffers(body: SearchBody): Promise<SearchResults> {
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

    const promises: Promise<AxiosResponse>[] = [];
    const providersNameArray: string[] = [];

    for (const providerName in providersUrls) {
      promises.push(
        this.getProviderPromise(providersUrls[providerName], resBody)
      );

      providersNameArray.push(providerName);
    }

    const providersDataResponses = await Promise.allSettled(promises);
    const providersData = {};
    providersDataResponses.forEach((item, key) => {
      //fulfilled is Promise.allSettled success status
      if (item.status === 'fulfilled') {
        providersData[providersNameArray[key]] = item.value.data;
      }
    });

    const commonData: SearchResults = {
      accommodations: {},
      offers: {},
      pricePlans: {}
    };

    for (const provider in providersData) {
      const data: SearchResponse = providersData[provider];
      const filteredAccommodations: string[] = [];
      for (const [key, value] of Object.entries(data.offers)) {
        if (assetsCurrencies.includes(value.price.currency)) {
          filteredAccommodations.push(
            Object.values(value.pricePlansReferences)[0].accommodation
          );
        } else {
          delete data.offers[key];
        }
      }

      if (!Object.keys(data.offers).length) {
        continue;
      }

      const accommodations = data.accommodations;

      const hotels = new Set<Accommodation>();
      const hotelsMap: {
        [k: string]: Accommodation;
      } = {};

      for (const [key, value] of Object.entries(accommodations)) {
        if (!filteredAccommodations.includes(key)) {
          continue;
        }

        const location: Location = {
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
        } as Accommodation;

        hotels.add(hotel);
        hotelsMap[key] = hotel;
      }

      if (!hotels.size) {
        continue;
      }

      await hotelRepository.bulkCreate(Array.from(hotels));

      const sortedHotels = Array.from(hotels);

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
        } as Accommodation;

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
          provider: provider as HotelProviders
        };

        offersSet.add(offerDBValue);
      });

      await offerRepository.bulkCreate(Array.from(offersSet));

      commonData.accommodations = {
        ...commonData.accommodations,
        ...hotelsMap
      };
      commonData.offers = {
        ...commonData.offers,
        ...data.offers
      };
      commonData.pricePlans = {
        ...commonData.pricePlans,
        ...data.pricePlans
      };
    }

    if (
      !Object.keys(commonData.accommodations).length ||
      !Object.keys(commonData.offers).length
    ) {
      throw ApiError.NotFound('Offers not found');
    }

    const sortedHotels = await hotelRepository.searchByRadius(
      lon,
      lat,
      radius,
      Object.keys(commonData.accommodations)
    );

    const sortedAccommodations: {
      [key: string]: Accommodation;
    } = {};

    sortedHotels.forEach((hotel: Accommodation) => {
      sortedAccommodations[hotel.id] = {
        ...commonData.accommodations[hotel.id],
        location: hotel.location as Location,
        id: hotel.id
      };
    });

    commonData.accommodations = sortedAccommodations;

    return commonData;
  }

  private getProviderPromise(
    providerUrl: string,
    resBody: SearchCriteria
  ): Promise<AxiosResponse> {
    return axios.post(`${providerUrl}/offers/search`, resBody, {
      headers: { Authorization: `Bearer ${clientJwt}` }
    });
  }

  public async getDerbySoftOfferPrice(offerId: string): Promise<PricedOffer> {
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
      throw e;
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

    await offerRepository.upsertOffer(offerDBValue);

    data.accommodation = {
      ...offer.accommodation,
      _id: offer.accommodation._id?.toString()
    };

    data.serviceId = utils.id(data.offerId);
    data.provider = utils.keccak256(
      utils.formatBytes32String('win_win_provider')
    );

    return data;
  }
}

export default new ProxyService();
