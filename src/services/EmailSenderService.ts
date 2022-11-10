import client from '@sendgrid/mail';
import LogService from './LogService';
import {
  sendgridApiKey,
  sendgridEmailFrom,
  sendgridEmailTemplateId,
  sendgridEmailTo
} from '../config';
import { OfferBackEnd } from '../types';
import { formatEmailDate } from '../utils';

export default class EmailSenderService {
  private readonly fromEmail: string;
  private message;

  constructor() {
    client.setApiKey(sendgridApiKey);
    this.fromEmail = sendgridEmailFrom;
  }

  public setMessage(offer: OfferBackEnd, passengers, tokenId: string) {
    const checkIn = offer.accommodation.checkinoutPolicy.checkinTime
      ? offer.accommodation.checkinoutPolicy.checkinTime.slice(0, -3)
      : '';
    const checkOut = offer.accommodation.checkinoutPolicy.checkoutTime
      ? offer.accommodation.checkinoutPolicy.checkoutTime.slice(0, -3)
      : '';
    const start_date = `${formatEmailDate(new Date(offer.arrival))} ${checkIn}`;
    const end_date = `${formatEmailDate(
      new Date(offer.departure)
    )} ${checkOut}`;
    const room =
      offer.accommodation.roomTypes[
        Object.keys(offer.accommodation.roomTypes)[0]
      ];

    const adults = offer.searchParams.guests.find((i) => i.type === 'ADT');
    const childs = offer.searchParams.guests.find((i) => i.type === 'CHD');

    const accommodationName = offer.accommodation.name;
    const googleMapsLink = `https://www.google.com/maps?hl=en&q=${encodeURIComponent(
      accommodationName
    )}`;

    this.message = {
      from: this.fromEmail,
      personalizations: [
        {
          to: [
            {
              email: sendgridEmailTo || passengers.PAX1.contactInformation[0], //todo validate
              name: `${passengers.PAX1.firstnames[0]} ${passengers.PAX1.lastnames[0]}`
            }
          ],
          dynamic_template_data: {
            name: accommodationName,
            price: `${offer.price?.public} ${offer.price?.currency}`,
            start_date,
            end_date,
            policy: '-',
            address: offer.accommodation.contactInformation.address,
            contact: {
              email:
                offer.accommodation.contactInformation.emails?.join(', ') ||
                'N/A',
              phone:
                offer.accommodation.contactInformation.phoneNumbers?.join(
                  ', '
                ) || 'N/A'
            },
            token_id: tokenId,
            room: room.name,
            room_description: room.description,
            rooms_count: offer.searchParams.roomCount,
            adult_guests_count: adults?.count || 0,
            child_guests_count: childs?.count || 0,
            google_maps_link: googleMapsLink,
            refundable:
              offer.refundability &&
              offer.refundability.type === 'refundable_with_deadline'
                ? true
                : false,
            deadline:
              offer.refundability && offer.refundability.deadline
                ? offer.refundability.deadline
                : '',
            penaltyAmount:
              offer.refundability && offer.refundability.penaltyAmount
                ? offer.refundability.penaltyAmount
                : ''
          }
        }
      ],
      template_id: sendgridEmailTemplateId || ''
    };
  }

  public async sendEmail() {
    await client.send(this.message).catch((error) => {
      LogService.red(error);
    });
  }
}
