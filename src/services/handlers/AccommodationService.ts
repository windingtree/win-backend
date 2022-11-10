import { Accommodation } from '@windingtree/glider-types/dist/accommodations';
import {
  MongoLocation,
  WinAccommodation
} from '@windingtree/glider-types/dist/win';
import {
  CachedWinAccommodation,
  Location,
  UserRequestDbData
} from '../../types';
import hotelRepository from '../../repositories/HotelRepository';
import userRequestRepository from '../../repositories/UserRequestRepository';
import { HotelQueueService } from '../HotelQueueService';
import { HandlerServiceConfig } from './helpers';
import { encodeProviderId } from '../../utils';

type KeyAccommodation = {
  [key: string]: Accommodation;
};

export class AccommodationService {
  public async processAccommodations(
    accommodations: KeyAccommodation,
    config: HandlerServiceConfig
  ): Promise<[WinAccommodation[], Record<string, WinAccommodation>]> {
    const { provider, searchBody, requestHash, sessionId } = config;
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
        providerHotelId: encodeProviderId(provider, value.hotelId),
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
        provider: String(hotel.provider),
        providerAccommodationId: hotel.hotelId,
        providerHotelId: encodeProviderId(provider, value.hotelId),
        requestBody: searchBody,
        requestHash: requestHash,
        sessionId,
        startDate: new Date(searchBody.accommodation.arrival)
      });
    }

    if (!hotels.size) {
      return [[], hotelsMap];
    }

    const hotelsArr: WinAccommodation[] = Array.from(hotels);

    await hotelRepository.bulkCreate(hotelsArr);
    await userRequestRepository.bulkCreate(Array.from(requests));
    HotelQueueService.getInstance().addHotelJobs(hotelsArr);

    return [hotelsArr, hotelsMap];
  }

  public getWinAccommodation(cachedAccommodation: CachedWinAccommodation) {
    return {
      _id: String(cachedAccommodation._id),
      checkinoutPolicy: cachedAccommodation.checkinoutPolicy,
      contactInformation: cachedAccommodation.contactInformation,
      description: cachedAccommodation.description,
      hotelId: cachedAccommodation.hotelId,
      id: cachedAccommodation.providerHotelId,
      location: cachedAccommodation.location,
      media: cachedAccommodation.media,
      name: cachedAccommodation.name,
      otherPolicies: cachedAccommodation.otherPolicies,
      providerHotelId: cachedAccommodation.providerHotelId,
      rating: cachedAccommodation.rating,
      roomTypes: cachedAccommodation.roomTypes,
      type: cachedAccommodation.type
    };
  }

  public async getSortedAccommodations(
    location: Location,
    accommodationIds: string[],
    unsortedAccommodations: Record<string, WinAccommodation>
  ): Promise<Record<string, WinAccommodation>> {
    const { lon, lat, radius } = location;
    const accommodations = await hotelRepository.searchByRadius(
      lon,
      lat,
      radius,
      accommodationIds
    );

    const sortedAccommodations: Record<string, WinAccommodation> = {};

    accommodations.forEach((hotel: WinAccommodation) => {
      sortedAccommodations[hotel.id] = {
        ...unsortedAccommodations[hotel.id],
        location: hotel.location,
        id: hotel.id
      };
    });

    return sortedAccommodations;
  }
}

export default new AccommodationService();
