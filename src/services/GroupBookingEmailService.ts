import client from '@sendgrid/mail';
import {
  sendgridApiKey,
  sendgridEmailFrom,
  sendgridGroupBookingEmailTemplateId
} from '../config';
import { OrganizerInformation } from '@windingtree/glider-types/dist/win';

export default class GroupBookingEmailService {
  private readonly fromEmail: string;
  private message;

  constructor() {
    client.setApiKey(sendgridApiKey);
    this.fromEmail = sendgridEmailFrom;
  }

  public setMessage(
    accommodationName: string,
    requestId: string,
    organizerInfo: OrganizerInformation
  ) {
    this.message = {
      from: this.fromEmail,
      personalizations: [
        {
          to: [
            {
              email: organizerInfo.emailAddress,
              name: `${organizerInfo.firstName} ${organizerInfo.lastName}`
            }
          ],
          dynamic_template_data: {
            orderId: requestId,
            property: {
              name: accommodationName
            }
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
