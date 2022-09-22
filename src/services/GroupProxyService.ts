import axios, { AxiosResponse } from 'axios';
import { clientJwt, providersUrls } from '../config';
import hotelRepository from '../repositories/HotelRepository';
import { makeCircumscribedSquare } from '../utils';
import offerRepository from '../repositories/OfferRepository';
import {
  SearchCriteria,
  SearchResponse
} from '@windingtree/glider-types/dist/accommodations';
import { OfferDbValue } from '@windingtree/glider-types/dist/win';
import { HotelProviders, SearchBody } from '../types';
import ApiError from '../exceptions/ApiError';
import {
  WinAccommodation,
  MongoLocation,
  SearchResults
} from '@windingtree/glider-types/dist/win';
import { assetsCurrencies } from '@windingtree/win-commons/dist/types';

export class GroupProxyService {
  public async getGroupOffers(body: SearchBody): Promise<SearchResults> {
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
        this.getProviderGroupSearchPromise(providersUrls[providerName], resBody)
      );

      providersNameArray.push(providerName);
    }

    const providersDataResponses = await Promise.allSettled(promises);
    const providersData: {
      [key: string]: SearchResponse;
    } = {};
    providersDataResponses.forEach((item, key) => {
      //fulfilled is Promise.allSettled success status
      if (item.status === 'fulfilled') {
        providersData[providersNameArray[key]] = item.value.data;
      }
    });

    const commonData = await this.processProvider(
      providersData,
      arrival,
      departure
    );

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

    const sortedAccommodations: Record<string, WinAccommodation> = {};

    sortedHotels.forEach((hotel: WinAccommodation) => {
      sortedAccommodations[hotel.id] = {
        ...commonData.accommodations[hotel.id],
        location: hotel.location,
        id: hotel.id
      };
    });

    commonData.accommodations = sortedAccommodations;

    return commonData;
  }

  private async processProvider(
    providersData: {
      [key: string]: SearchResponse;
    },
    arrival: string,
    departure: string
  ): Promise<SearchResults> {
    const commonData: SearchResults = {
      accommodations: {},
      offers: {},
      pricePlans: {}
    };

    for (const provider in providersData) {
      const data: SearchResponse = providersData[provider];
      if (!data) {
        continue;
      }
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

      const hotels = new Set<WinAccommodation>();
      const hotelsMap: Record<string, WinAccommodation> = {};

      for (const [key, value] of Object.entries(accommodations)) {
        if (!filteredAccommodations.includes(key)) {
          continue;
        }

        const location: MongoLocation = {
          coordinates: [
            Number(value.location?.long),
            Number(value.location?.lat)
          ],
          type: 'Point'
        };

        const hotel: WinAccommodation = {
          ...value,
          id: key,
          provider: provider,
          createdAt: new Date(),
          location
        };

        hotels.add(hotel);
        hotelsMap[key] = hotel;
      }

      if (!hotels.size) {
        continue;
      }

      await hotelRepository.bulkCreate(Array.from(hotels));

      const sortedHotels = Array.from(hotels);

      const { offers } = data;

      const offersSet = new Set<OfferDbValue>();

      Object.keys(offers).map((k) => {
        const offer = offers[k];
        const { pricePlansReferences } = offer;
        const { roomType } =
          pricePlansReferences[Object.keys(pricePlansReferences)[0]];
        const accommodationId =
          pricePlansReferences[Object.keys(pricePlansReferences)[0]]
            .accommodation;
        const accommodation = {
          ...sortedHotels.find((v) => v.id === accommodationId)
        } as WinAccommodation;

        if (accommodation.roomTypes && accommodation.roomTypes[roomType]) {
          accommodation.roomTypes = {
            [roomType]: accommodation.roomTypes[roomType]
          };
        }

        offer.price = {
          currency: offer.price.currency,
          private: offer.price.private
            ? String(offer.price.private)
            : undefined,
          public: String(offer.price.public),
          commission: offer.price.commission
            ? String(offer.price.commission)
            : undefined,
          taxes: offer.price.taxes ? String(offer.price.taxes) : undefined,
          isAmountBeforeTax: offer.price.isAmountBeforeTax,
          decimalPlaces: offer.price.decimalPlaces
        };

        const offerDBValue: OfferDbValue = {
          id: k,
          accommodation,
          accommodationId,
          pricePlansReferences,
          arrival: new Date(arrival).toISOString(),
          departure: new Date(departure).toISOString(),
          expiration: new Date(offer.expiration).toISOString(),
          price: offer.price,
          provider: provider as HotelProviders,
          pricedItems: [],
          disclosures: []
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

    return commonData;
  }

  private getProviderGroupSearchPromise(
    providerUrl: string,
    resBody: SearchCriteria
  ): Promise<AxiosResponse> {
    return axios.post(`${providerUrl}/groups/search`, resBody, {
      headers: { Authorization: `Bearer ${clientJwt}` }
    });
  }
}

export default new GroupProxyService();
