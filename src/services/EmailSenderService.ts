import client from '@sendgrid/mail';
import LogService from './LogService';
import {
  sendgridApiKey,
  sendgridEmailFrom,
  sendgridEmailTemplateId,
  sendgridEmailTo
} from '../config';
import { OfferBackEnd } from '../types';

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
    const start_date = `${new Date(offer.arrival).toDateString()} ${checkIn}`;
    const end_date = `${new Date(offer.departure).toDateString()} ${checkOut}`;
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
            name: offer.accommodation.name,
            price: `${offer.price?.public} ${offer.price?.currency}`,
            start_date,
            end_date,
            policy: '-',
            address: offer.accommodation.contactInformation.address,
            contact: {
              email: offer.accommodation.contactInformation.emails?.join(', '),
              phone:
                offer.accommodation.contactInformation.phoneNumbers?.join(', ')
            },
            token_id: tokenId
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
