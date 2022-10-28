import { HotelProviders, OfferBackEnd } from '../../types';
import {
  Offer,
  PricePlan,
  RefundabilityPolicy,
  WinAccommodation
} from '@windingtree/glider-types/dist/win';
import offerRepository from '../../repositories/OfferRepository';
import { HandlerServiceConfig } from './helpers';

type KeyOffers = { [p: string]: Offer };
type KeyPricedPlans = { [p: string]: PricePlan } | undefined;

export class OfferService {
  public async processOffers(
    offers: KeyOffers,
    pricePlans: KeyPricedPlans,
    processedHotels: WinAccommodation[],
    config: HandlerServiceConfig
  ) {
    const { provider, searchBody, requestHash, sessionId } = config;
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
        ...processedHotels.find((v) => v.id === accommodationId)
      } as WinAccommodation;
      let pricePlan = {};
      if (pricePlans) {
        pricePlan = pricePlans[Object.keys(pricePlansReferences)[0]];
      }
      if (accommodation.roomTypes && accommodation.roomTypes[roomType]) {
        accommodation.roomTypes = {
          [roomType]: accommodation.roomTypes[roomType]
        };
      }

      offer.price = {
        currency: offer.price.currency,
        private: offer.price.private ? String(offer.price.private) : undefined,
        public: String(offer.price.public),
        commission: offer.price.commission
          ? String(offer.price.commission)
          : undefined,
        taxes: offer.price.taxes ? String(offer.price.taxes) : undefined,
        isAmountBeforeTax: offer.price.isAmountBeforeTax,
        decimalPlaces: offer.price.decimalPlaces
      };
      //this is to ensure we always get refundability policy in FE (so far derbysoft does not return that)
      this.decorateOfferWithDefaultRefundabilityPolicy(offer);
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
        pricePlan,
        refundability: offer.refundability
          ? offer.refundability
          : this.getDefaultRefundabilityPolicy(),
        searchParams: {
          guests: searchBody.passengers,
          roomCount: Number(searchBody.accommodation.roomCount)
        }
      };

      offersSet.add(offerDBValue);
    });

    await offerRepository.bulkCreate(Array.from(offersSet));
  }

  private decorateOfferWithDefaultRefundabilityPolicy(offer: Offer): void {
    //in case offer does not have refundability policy, we need to assume it's non refundable (most restrictive option)
    if (!offer.refundability) {
      offer.refundability = this.getDefaultRefundabilityPolicy();
    }
  }

  private getDefaultRefundabilityPolicy(): RefundabilityPolicy {
    return { type: 'non_refundable' };
  }
}

export default new OfferService();
