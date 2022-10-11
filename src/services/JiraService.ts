import { Version3Client } from 'jira.js';
import { CreateIssue } from 'jira.js/out/version3/parameters';
import {
  jiraURL,
  jiraEmailAddress,
  jiraToken,
  jiraProjectId,
  jiraGroupIssueId,
  appEnvironment
} from '../config';
import { GroupBookingRequestDBValue, GroupRoom } from '../types';
import {
  GroupBookingDeposits,
  OfferDbValue,
  OrganizerInformation
} from '@windingtree/glider-types/dist/win';
import { CreatedIssue } from 'jira.js/out/version3/models';
import { BillingAddress } from '@windingtree/glider-types/dist/simard';
import { NetworkInfo } from '@windingtree/win-commons/dist/types';

// Note: this service is only used today to log the group booking requests.
export default class JiraService {
  private client: Version3Client;
  private issueTypeID: string;
  private projectID: string;
  private summaryPrefix: string;

  constructor() {
    this.client = new Version3Client({
      host: jiraURL,
      authentication: {
        basic: {
          email: jiraEmailAddress,
          apiToken: jiraToken
        }
      }
    });

    this.projectID = jiraProjectId;
    this.issueTypeID = jiraGroupIssueId;
    if (appEnvironment !== 'production') {
      this.summaryPrefix = '[TEST] ';
    } else {
      this.summaryPrefix = '';
    }
  }

  public async createJiraTicket(
    bookingRequest: GroupBookingRequestDBValue
  ): Promise<CreatedIssue> {
    const parameters = this.createGroupBookingIssueParameters(bookingRequest);
    return await this.client.issues.createIssue(parameters);
  }

  private createGroupBookingIssueParameters(
    bookingRequest: GroupBookingRequestDBValue
  ): CreateIssue {
    const {
      contact,
      rooms,
      invoice,
      guestsCount,
      totals,
      depositOptions,
      paymentCurrency,
      serviceId,
      contract
    } = bookingRequest;
    const summary =
      this.summaryPrefix +
      `Group Booking Request: ${contact.firstName} ${contact.lastName}`;
    const checkInDate = rooms[0].offer.arrival;
    const checkOutDate = rooms[0].offer.departure;
    const hotelName = rooms[0].offer.accommodation.name;
    const hotelEmail =
      rooms[0].offer.accommodation.contactInformation.emails[0] ?? '';
    const address = rooms[0].offer.accommodation.contactInformation.address;
    const hotelAddress = `${address.streetAddress}, ${address.locality}, ${address.country}`;

    return {
      fields: {
        summary: summary,
        project: {
          id: this.projectID
        },
        issuetype: {
          id: this.issueTypeID
        },
        customfield_10048: checkInDate,
        customfield_10049: checkOutDate,
        customfield_10053: hotelName,
        customfield_10055: hotelEmail,
        customfield_10061: toDealChain(contract),
        customfield_10062: serviceId,
        customfield_10059: toParagraph(hotelAddress),
        description: toDescriptionString(
          rooms,
          guestsCount,
          depositOptions,
          totals,
          paymentCurrency ?? ''
        ),
        customfield_10064: toParagraph(toOrganizerDetailsString(contact)),
        customfield_10065: toParagraph(toOrganizationDetailsString(contact)),
        customfield_10067: toInvoice(invoice)
      }
    };
  }
}

const toParagraph = (text: string) => {
  if (!text) {
    text = ' '; // Empty text generates errors.
  }
  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: [
          {
            text: text,
            type: 'text'
          }
        ]
      }
    ]
  };
};

const toDescriptionString = (
  rooms: GroupRoom[],
  guestCount: number,
  depositOptions: GroupBookingDeposits,
  totals: GroupBookingDeposits,
  paymentCurrency: string
): string => {
  let str = `Booking Request for ${guestCount} adults:\n`;
  str += toOffersString(rooms);
  str += toDepositString(depositOptions, paymentCurrency);
  str += toTotalString(totals);
  str += toOfferProvider(rooms[0].offer);
  return str;
};

const toOffersString = (rooms: GroupRoom[]): string => {
  let str = '';
  rooms.forEach((value: GroupRoom) => {
    try {
      const pricePlanRef = Object.keys(value.offer.pricePlansReferences)[0];
      const roomTypeRef =
        value.offer.pricePlansReferences[pricePlanRef].roomType;
      const roomName = value.offer.accommodation.roomTypes[roomTypeRef].name;
      str += `${value.quantity} x ${roomName}\n`;
    } catch (e) {
      str += `${value.quantity} x unreadableRoomName\n`;
    }
  });
  return str;
};

const toDepositString = (
  depositOptions: GroupBookingDeposits,
  paymentCurrency: string
): string => {
  let str = `Deposit: ${depositOptions.offerCurrency.currency} ${depositOptions.offerCurrency.amount} `;
  if (
    paymentCurrency &&
    paymentCurrency !== depositOptions.offerCurrency.currency
  ) {
    str += `(paid in ${paymentCurrency})`;
  }
  return str + '\n';
};

const toTotalString = (totals: GroupBookingDeposits): string => {
  const str = `Total: ${totals.offerCurrency.currency} ${totals.offerCurrency.amount}\n`;
  return str;
};

const toOfferProvider = (offer: OfferDbValue): string => {
  const str = `\nOffer coming from ${offer.provider}\n`;
  return str;
};
const toOrganizerDetailsString = (contact: OrganizerInformation): string => {
  let str = '';
  str += `name: ${contact.firstName} ${contact.lastName}\n`;
  str += `email: ${contact.emailAddress}\n`;
  str += `phone: ${contact.phoneNumber}`;
  if (contact.billingInfo && !contact.billingInfo.companyName) {
    str += `Billing Address: ${toBillingAddressString(
      contact.billingInfo.address
    )}\n`;
  }
  return str;
};

const toOrganizationDetailsString = (contact: OrganizerInformation): string => {
  let str = '';
  if (contact.billingInfo && contact.billingInfo.companyName) {
    str += `Company Name: ${contact.billingInfo.companyName}\n`;
    str += `Billing Address: ${toBillingAddressString(
      contact.billingInfo.address
    )}\n`;
    if (contact.billingInfo.vatNumber)
      str += `VAT Number: ${contact.billingInfo.vatNumber} \n`;
  } else {
    str += 'The customer is not a corporate.';
  }
  return str;
};

const toBillingAddressString = (billingAddress: BillingAddress): string => {
  let str = '';
  str += `${billingAddress.street}, `;
  if (billingAddress.postalCode) str += `${billingAddress.postalCode}, `;
  str += `${billingAddress.cityName}, `;
  if (billingAddress.stateProv) str += `${billingAddress.stateProv}, `;
  str += `${billingAddress.countryCode} `;
  return str;
};

const toDealChain = (contract: NetworkInfo | undefined): { value: string } => {
  // Possible names from config: 'Localhost' | 'Sokol Testnet' | 'Gnosis Chain' | 'Polygon PoS Chain'
  let chainName: 'Gnosis Chain' | 'Polygon' = 'Gnosis Chain';
  if (contract && contract.name === 'Polygon PoS Chain') {
    chainName = 'Polygon';
  }
  return {
    value: chainName // "com.atlassian.jira.plugin.system.customfieldtypes:radiobuttons"
  };
};

const toInvoice = (invoice: boolean): { value: string } => {
  const value = invoice ? 'YES' : 'NO';
  return {
    value // com.atlassian.jira.plugin.system.customfieldtypes:select
  };
};
