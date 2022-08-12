import axios from 'axios';
import { clientJwt, derbySoftProxyUrl } from '../config';
import hotelRepository from '../repositories/HotelRepository';
import { makeCircumscribedSquare } from '../utils';
import LogService from './LogService';
import offerRepository from '../repositories/OfferRepository';

interface HotelResponse {
  data: Array<unknown>;
  status: string;
}

export class ProxyService {
  public async getAllHotels(): Promise<HotelResponse> {
    const res = await axios.get(`${derbySoftProxyUrl}/hotels`, {
      headers: { Authorization: `Bearer ${clientJwt}` }
    });

    return res.data;
  }

  public async getHotels(
    lon: number,
    lat: number,
    radius: number
  ): Promise<any[]> {
    const rectangle = makeCircumscribedSquare(lon, lat, radius);
    const res = await axios.post(
      `${derbySoftProxyUrl}/hotels/search`,
      { location: { rectangle } },
      { headers: { Authorization: `Bearer ${clientJwt}` } }
    );

    return res.data.data;
  }

  //todo typings
  public async getDerbySoftOffers(body): Promise<any> {
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
      LogService.red(e);
      return {
        data: {},
        status: e.response.status,
        message: e.response.data.error
      };
    }

    const { data } = res.data;
    const accommodations = data.accommodations as Record<any, any>;

    const hotels = new Set();

    for (const [key, value] of Object.entries(accommodations)) {
      const location = value.location;
      delete value.location;
      const hotel = {
        id: key,
        provider: 'derbySoft',
        location: {
          coordinates: [location.long, location.lat],
          type: 'Point'
        },
        createdAt: new Date(),
        ...value
      };

      hotels.add(hotel);
    }

    await hotelRepository.upsertHotels(Array.from(hotels));
    data.accommodations = await hotelRepository.searchByRadius(
      lon,
      lat,
      radius
    );

    const { offers } = res.data.data;

    const offersSet = new Set();

    Object.keys(offers).map((k) => {
      const v = offers[k];
      v.id = k;
      v.expiration = new Date(v.expiration);
      const { pricePlansReferences } = v;
      const { accommodation, roomType } =
        pricePlansReferences[Object.keys(pricePlansReferences)[0]];

      v.accommodation = {
        ...data.accommodations.find((v) => v.id === accommodation)
      };

      v.accommodation.roomType = v.accommodation.roomTypes[roomType];
      delete v.accommodation.roomTypes;
      v.arrival = arrival;
      v.departure = departure;
      v.pricedItems = null;
      v.disclosures = null;

      offersSet.add(v);
    });

    await offerRepository.bulkCreate(Array.from(offersSet));

    return {
      data,
      status: res.data.status
    };
  }

  public async getDerbySoftOfferPrice(offerId: string) {
    try {
      const res = await axios.post(
        `${derbySoftProxyUrl}/offers/${offerId}/price`,
        {},
        {
          headers: { Authorization: `Bearer ${clientJwt}` }
        }
      );
      const offer = await offerRepository.getOne(offerId);

      const { data } = res.data;
      const expiration = new Date(data.offer.expiration);

      offer.id = data.offerId;
      offer._id = null;
      offer.expiration = expiration;
      offer.price = data.offer.price;
      offer.pricedItems = data.offer.pricedItems;
      offer.disclosures = data.offer.disclosures;

      await offerRepository.create(offer);

      return res.data;
    } catch (e) {
      LogService.red(e);
      return {
        data: {}
      };
    }
  }
}

export default new ProxyService();
