import axios, { AxiosResponse } from 'axios';
import {
  clientJwt,
  getUrlByKey,
  providersUrls,
  serviceProviderId,
  simardJwt,
  simardUrl
} from '../config';
import hotelRepository from '../repositories/HotelRepository';
import { getContractServiceId, makeCircumscribedSquare } from '../utils';
import LogService from './LogService';
import offerRepository from '../repositories/OfferRepository';
import ApiError from '../exceptions/ApiError';
import { utils } from 'ethers';
import {
  MongoLocation,
  Offer,
  SearchResults,
  WinAccommodation,
  WinPricedOffer
} from '@windingtree/glider-types/dist/win';
import { DateTime } from 'luxon';
import userRequestRepository from '../repositories/UserRequestRepository';
import {
  HotelProviders,
  OfferBackEnd,
  SearchBody,
  UserRequestDbData
} from '../types';
import {
  SearchCriteria,
  SearchResponse
} from '@windingtree/glider-types/dist/accommodations';
import { Quote } from '@windingtree/glider-types/dist/simard';
import { HotelQueueService } from './HotelQueueService';
import cachedHotelRepository from '../repositories/CachedHotelRepository';

export class ProxyService {
  public async getProxiesOffers(
    body: SearchBody,
    sessionId: string
  ): Promise<SearchResults> {
    return await this.proxiesSearch(body, sessionId, this.getProviderPromise);
  }

  public async getGroupOffers(
    body: SearchBody,
    sessionId: string
  ): Promise<SearchResults> {
    return await this.proxiesSearch(
      body,
      sessionId,
      this.getProviderGroupSearchPromise
    );
  }

  private async proxiesSearch(
    body: SearchBody,
    sessionId: string,
    getProviderPromise: (
      providerUrl: string,
      resBody: SearchCriteria
    ) => Promise<AxiosResponse>
  ): Promise<SearchResults> {
    const { lon, lat, radius } = body.accommodation.location;
    const rectangle = makeCircumscribedSquare(lon, lat, radius);
    const requestHash = utils.id(JSON.stringify(body));
    const cashedOffers = await this.getCachedOffers(sessionId, requestHash);
    if (cashedOffers) {
      cashedOffers.offers = await this.addRates(cashedOffers.offers);
      return cashedOffers;
    }

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
      promises.push(getProviderPromise(providersUrls[providerName], resBody));

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
      body,
      requestHash,
      sessionId
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
    searchBody: SearchBody,
    requestHash: string,
    sessionId: string
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

      if (!Object.keys(data.offers).length) {
        continue;
      }

      const accommodations = data.accommodations;

      const hotels = new Set<WinAccommodation>();
      const hotelsMap: Record<string, WinAccommodation> = {};
      const requests = new Set<UserRequestDbData>();

      for (const [key, value] of Object.entries(accommodations)) {
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
          providerHotelId: utils.id(`${provider}_${value.hotelId}`),
          provider,
          createdAt: new Date(),
          location
        };

        hotels.add(hotel);
        hotelsMap[key] = hotel;

        requests.add({
          _id: null,
          accommodationId: key,
          hotelLocation: hotel.location,
          provider: String(hotel.provider), //todo remove String() after use new glider types
          providerAccommodationId: hotel.hotelId,
          providerHotelId: utils.id(`${provider}_${value.hotelId}`),
          requestBody: searchBody,
          requestHash: requestHash,
          sessionId,
          startDate: new Date(searchBody.accommodation.arrival)
        });
      }

      if (!hotels.size) {
        continue;
      }

      await hotelRepository.bulkCreate(Array.from(hotels));
      await userRequestRepository.bulkCreate(Array.from(requests));
      HotelQueueService.getInstance().addHotelJobs(Array.from(hotels));

      const sortedHotels = Array.from(hotels);

      const { offers } = data;

      const offersSet = new Set<OfferBackEnd>();

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
        let pricePlan = {};
        if (data.pricePlans) {
          pricePlan = data.pricePlans[Object.keys(pricePlansReferences)[0]];
        }
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

        const offerDBValue: OfferBackEnd = {
          id: k,
          accommodation,
          accommodationId,
          pricePlansReferences,
          arrival: new Date(searchBody.accommodation.arrival).toISOString(),
          departure: new Date(searchBody.accommodation.departure).toISOString(),
          expiration: new Date(offer.expiration),
          price: offer.price,
          provider: provider as HotelProviders,
          pricedItems: [],
          disclosures: [],
          requestHash,
          sessionId,
          pricePlan
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

    commonData.offers = await this.addRates(commonData.offers);

    return commonData;
  }

  private async getCachedOffers(
    sessionId: string,
    requestHash: string
  ): Promise<SearchResults | null> {
    const cashedOffers = (
      await offerRepository.getBySession(sessionId, requestHash)
    ).filter((offer) => {
      return (
        DateTime.fromJSDate(offer.expiration).diffNow('minutes').minutes > 10
      );
    });

    if (!cashedOffers.length) {
      return null;
    }

    const hotelIds: string[] = [
      ...new Set(cashedOffers.map((offer) => offer.accommodationId))
    ];
    const hotels = await hotelRepository.getByIds(hotelIds);

    if (!hotels.length) {
      return null;
    }

    const offersMap: {
      [k: string]: Offer;
    } = {};

    cashedOffers.forEach((v) => {
      offersMap[v.id] = {
        expiration: new Date(v.expiration).toISOString(),
        price: v.price,
        pricePlansReferences: v.pricePlansReferences
      };
    });

    const accommodations: {
      [k: string]: WinAccommodation;
    } = {};

    hotels.forEach((hotel) => {
      accommodations[hotel.id] = hotel;
    });

    return {
      accommodations,
      offers: offersMap
    };
  }

  private getProviderPromise(
    providerUrl: string,
    resBody: SearchCriteria
  ): Promise<AxiosResponse> {
    return axios.post(`${providerUrl}/offers/search`, resBody, {
      headers: { Authorization: `Bearer ${clientJwt}` }
    });
  }

  private getProviderGroupSearchPromise(
    providerUrl: string,
    resBody: SearchCriteria
  ): Promise<AxiosResponse> {
    return axios.post(`${providerUrl}/groups/search`, resBody, {
      headers: { Authorization: `Bearer ${clientJwt}` }
    });
  }

  public async getProxyOfferPrice(offerId: string): Promise<WinPricedOffer> {
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
      if (e.status !== 404 || process.env.NODE_IS_TEST !== 'true') {
        LogService.red(e);
      }
      throw e;
    }

    const { data } = res;

    let quote: Quote | undefined;

    if (data.offer.price.currency !== 'USD') {
      try {
        const quoteData = {
          targetCurrency: data.offer.price.currency,
          targetAmount: data.offer.price.public,
          sourceCurrency: 'USD'
        };
        const quoteRes = await axios.post(`${simardUrl}/quotes`, quoteData, {
          headers: { Authorization: `Bearer ${simardJwt}` }
        });

        quote = quoteRes.data;
      } catch (e) {
        if (e.status !== 404 || process.env.NODE_IS_TEST !== 'true') {
          LogService.red(e);
        }
      }
    }

    const expiration = new Date(data.offer.expiration);

    data.offer.price = {
      currency: data.offer.price.currency,
      private: data.offer.price.private
        ? String(data.offer.price.private)
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

    const offerDBValue: OfferBackEnd = {
      arrival: offer.arrival,
      departure: offer.departure,
      id: data.offerId,
      accommodation: offer.accommodation,
      accommodationId: offer.accommodationId,
      pricePlansReferences: offer.pricePlansReferences,
      expiration: expiration,
      pricedItems: data.offer.pricedItems,
      disclosures: data.offer.disclosures,
      price: data.offer.price,
      provider: offer.provider,
      sessionId: offer.sessionId,
      requestHash: offer.requestHash,
      pricePlan: offer.pricePlan,
      quote
    };

    await offerRepository.upsertOffer(offerDBValue);

    data.accommodation = {
      ...offer.accommodation,
      _id: offer.accommodation._id?.toString()
    };

    data.serviceId = getContractServiceId(data.offerId);
    data.provider = serviceProviderId;

    return {
      ...data,
      ...{ quote }
    };
  }

  private async getRates(
    currencies: string[]
  ): Promise<{ [k: string]: number }> {
    const rates = {};
    for (const currency of currencies) {
      const ratesData = {
        source: currency,
        target: 'USD'
      };
      try {
        const quoteRes = await axios.get(`${simardUrl}/rates`, {
          params: ratesData,
          headers: { Authorization: `Bearer ${simardJwt}` }
        });
        rates[currency] = quoteRes.data.rate;
      } catch (e) {
        // error
      }
    }

    return rates;
  }

  private async addRates(offers: { [k: string]: Offer }): Promise<{
    [k: string]: Offer;
  }> {
    const currencies: string[] = [
      ...new Set(Object.values(offers).map((offer) => offer.price.currency))
    ];

    const rates = await this.getRates(currencies);

    for (const key in offers) {
      const offer = offers[key];
      const { currency } = offer.price;
      if (currency !== 'USD' && rates[currency]) {
        const usdPrice =
          parseFloat(offer.price.public || '0') * rates[currency];
        offers[key].convertedPrice = {
          USD: usdPrice.toFixed(2)
        };
      }
    }

    return offers;
  }

  public async getPricedOffer(offerId: string): Promise<WinPricedOffer> {
    const offer = await offerRepository.getOne(offerId);

    if (!offer || !offer.price || !offer.pricedItems || !offer.disclosures) {
      throw ApiError.NotFound('offer not found');
    }

    return {
      accommodation: offer.accommodation,
      offer: {
        expiration: new Date(offer.expiration).toISOString(),
        price: offer.price,
        pricedItems: offer.pricedItems,
        disclosures: offer.disclosures
      },
      offerId: offer.id,
      provider: serviceProviderId,
      serviceId: getContractServiceId(offer.id)
    };
  }

  public async getAccommodation(
    providerHotelId: string,
    sessionId: string,
    body: SearchBody
  ): Promise<SearchResults> {
    const requestHash = utils.id(JSON.stringify(body));
    const userRequest = await userRequestRepository.getRequestByProviderHotelId(
      providerHotelId,
      requestHash
    );

    if (!userRequest) {
      throw ApiError.NotFound('offer not found');
    }

    const accommodationId = userRequest.accommodationId;

    let offers = await offerRepository.getByAccommodation(accommodationId);
    let accommodation = await hotelRepository.getOne(accommodationId);
    let newAccommodationId = '';

    if (!offers.length || !accommodation) {
      const searchBody: SearchBody = userRequest.requestBody;
      searchBody.accommodation.location = {
        lon: userRequest.hotelLocation.coordinates[0],
        lat: userRequest.hotelLocation.coordinates[1],
        radius: 5
      };
      const search = await this.getProxiesOffers(
        userRequest.requestBody,
        sessionId
      );

      for (const [key, value] of Object.entries(search.accommodations)) {
        if (value.hotelId === userRequest.providerAccommodationId) {
          newAccommodationId = key;
          break;
        }
      }

      offers = await offerRepository.getByAccommodation(newAccommodationId);
      accommodation = await hotelRepository.getOne(newAccommodationId);
    }

    if (!accommodation || !offers.length) {
      throw ApiError.NotFound('offer not found');
    }

    const offersMap: {
      [k: string]: Offer;
    } = {};

    offers.forEach((v) => {
      offersMap[v.id] = {
        expiration: new Date(v.expiration).toISOString(),
        price: v.price,
        pricePlansReferences: v.pricePlansReferences
      };
    });

    return {
      accommodations: {
        [newAccommodationId || accommodationId]: accommodation
      },
      offers: offersMap
    };
  }

  public async getHotelInfo(
    providerHotelId: string
  ): Promise<WinAccommodation> {
    const cachedHotel = await cachedHotelRepository.getOne(providerHotelId);

    if (!cachedHotel) {
      throw ApiError.NotFound('Hotel not found');
    }

    return {
      _id: String(cachedHotel._id),
      checkinoutPolicy: cachedHotel.checkinoutPolicy,
      contactInformation: cachedHotel.contactInformation,
      description: cachedHotel.description,
      hotelId: cachedHotel.hotelId,
      id: cachedHotel.providerHotelId,
      location: cachedHotel.location,
      media: cachedHotel.media,
      name: cachedHotel.name,
      otherPolicies: cachedHotel.otherPolicies,
      provider: cachedHotel.provider,
      providerHotelId: cachedHotel.providerHotelId,
      rating: cachedHotel.rating,
      roomTypes: cachedHotel.roomTypes,
      type: cachedHotel.type
    };
  }
}

export default new ProxyService();
