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
import {
  decodeProviderId,
  getContractServiceId,
  makeCircumscribedSquare
} from '../utils';
import LogService from './LogService';
import offerRepository from '../repositories/OfferRepository';
import ApiError from '../exceptions/ApiError';
import { utils } from 'ethers';
import {
  Offer,
  SearchResults,
  WinAccommodation,
  WinPricedOffer
} from '@windingtree/glider-types/dist/win';
import { DateTime } from 'luxon';
import { OfferBackEnd, SearchBody } from '../types';
import {
  Accommodation,
  SearchCriteria,
  SearchResponse
} from '@windingtree/glider-types/dist/accommodations';
import { Quote } from '@windingtree/glider-types/dist/simard';
import cachedHotelRepository from '../repositories/CachedHotelRepository';
import accommodationService from './handlers/AccommodationService';
import offerService from './handlers/OfferService';
import { HandlerServiceConfig } from './handlers/helpers';
import currencyService from './CurrencyService';

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

  public async getSingleProxyOffers(
    body: SearchBody,
    sessionId: string,
    providerName
  ): Promise<SearchResults> {
    return await this.proxiesSearch(body, sessionId, this.getProviderPromise, [
      providerName
    ]);
  }

  private async proxiesSearch(
    body: SearchBody,
    sessionId: string,
    getProviderPromise: (
      providerUrl: string,
      resBody: SearchCriteria
    ) => Promise<AxiosResponse>,
    providerNames = Object.keys(providersUrls)
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

    for (const providerName of providerNames) {
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

    commonData.accommodations =
      await accommodationService.getSortedAccommodations(
        body.accommodation.location,
        Object.keys(commonData.accommodations),
        commonData.accommodations
      );

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
      if (!data || !Object.keys(data.offers).length) {
        continue;
      }

      const accommodations: { [key: string]: Accommodation } =
        data.accommodations;

      const serviceConfig: HandlerServiceConfig = {
        provider,
        searchBody,
        requestHash,
        sessionId
      };

      const [processedHotels, hotelsMap] =
        await accommodationService.processAccommodations(
          accommodations,
          serviceConfig
        );

      await offerService.processOffers(
        data.offers,
        data.pricePlans,
        processedHotels,
        serviceConfig
      );

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
        pricePlansReferences: v.pricePlansReferences,
        refundability: v.refundability
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
      quote,
      refundability: offer?.refundability,
      searchParams: offer.searchParams
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

  private async addRates(offers: { [k: string]: Offer }): Promise<{
    [k: string]: Offer;
  }> {
    const rates = await currencyService.getCurrencies();

    for (const key in offers) {
      const offer = offers[key];
      const { currency } = offer.price;
      if (currency !== rates.baseCurrency && rates.currencies[currency]) {
        const rate = rates.currencies[currency].rateFromBaseCurrency;
        const usdPrice =
          parseFloat(offer.price.public || '0') * parseFloat(rate);
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
    const { uniqueId: accommodationId, providerName } =
      decodeProviderId(providerHotelId);
    body.accommodation.hotelIds = [accommodationId];
    return await this.getSingleProxyOffers(body, sessionId, providerName);
  }

  public async getHotelInfo(
    providerHotelId: string
  ): Promise<WinAccommodation> {
    const cachedAccommodation = await cachedHotelRepository.getOne(
      providerHotelId
    );

    if (!cachedAccommodation) {
      throw ApiError.NotFound('Hotel not found');
    }

    return accommodationService.getWinAccommodation(cachedAccommodation);
  }
}

export default new ProxyService();
