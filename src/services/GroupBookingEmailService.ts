import client from '@sendgrid/mail';
import {
  sendgridApiKey,
  sendgridEmailFrom,
  sendgridGroupBookingEmailTemplateId
} from '../config';
import { GroupBookingDeposits } from '@windingtree/glider-types/dist/win';
import { GroupBookingRequestDBValue } from 'src/types';
import { formatEmailDate } from '../utils';

export default class GroupBookingEmailService {
  private readonly fromEmail: string;
  private message;

  constructor() {
    client.setApiKey(sendgridApiKey);
    this.fromEmail = sendgridEmailFrom;
  }

  public setMessage(bookingRequest: GroupBookingRequestDBValue) {
    const {
      contact,
      requestId,
      rooms,
      depositOptions,
      paymentCurrency,
      guestsCount
    } = bookingRequest;
    const offer = rooms[0].offer;
    const accommodationName = offer.accommodation.name;
    let nbRooms = 0;
    for (const room of rooms) {
      nbRooms += room.quantity;
    }

    this.message = {
      from: this.fromEmail,
      personalizations: [
        {
          to: [
            {
              email: contact.emailAddress,
              name: `${contact.firstName} ${contact.lastName}`
            }
          ],
          dynamic_template_data: {
            orderId: requestId,
            property: {
              name: accommodationName
            },
            deposit: depositString(depositOptions, paymentCurrency ?? ''),
            checkIn: formatEmailDate(new Date(offer.arrival)),
            checkOut: formatEmailDate(new Date(offer.departure)),
            adults: String(guestsCount),
            rooms: String(nbRooms)
          }
        }
      ],
      template_id: sendgridGroupBookingEmailTemplateId || ''
    };
  }

  public async sendEmail() {
    await client.send(this.message);
  }
}

const depositString = (
  depositOptions: GroupBookingDeposits,
  paymentCurrency: string
): string => {
  if (
    !paymentCurrency ||
    paymentCurrency == depositOptions.offerCurrency.currency
  ) {
    return `${depositOptions.offerCurrency.currency} ${depositOptions.offerCurrency.amount}`;
  }
  if (
    depositOptions.preferredCurrency &&
    paymentCurrency == depositOptions.preferredCurrency.currency
  ) {
    return `${depositOptions.preferredCurrency.currency} ${depositOptions.preferredCurrency.amount}`;
  }
  if (paymentCurrency == 'USD') {
    return `USD ${depositOptions.usd}`;
  }

  return '';
};
