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
import { GroupRoom } from '../types';
import {
  GroupBookingDeposits,
  OrganizerInformation
} from '@windingtree/glider-types/dist/win';
import LogService from './LogService';
import { CreatedIssue } from 'jira.js/out/version3/models';

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
    rooms: GroupRoom[],
    contact: OrganizerInformation,
    invoice: boolean,
    guestsCount: number,
    depositOptions: GroupBookingDeposits,
    totals: GroupBookingDeposits,
    requestId: string
  ): Promise<CreatedIssue> {
    const parameters = this.createGroupBookingIssueParameters(
      rooms,
      contact,
      invoice,
      guestsCount,
      depositOptions,
      totals,
      requestId
    );
    const result = await this.client.issues.createIssue(parameters);
    return result;
  }

  // TODO: we need to add more fields to the template: offer1, offer2, offer3, with quantities, the deposit, the organizer info,...
  // We need also to change the states of the template, it should start with "Deposit Paid".
  private createGroupBookingIssueParameters(
    rooms: GroupRoom[],
    contact: OrganizerInformation,
    invoice: boolean,
    guestsCount: number,
    depositOptions: GroupBookingDeposits,
    totals: GroupBookingDeposits,
    requestId: string
  ): CreateIssue {
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
    const currency = rooms[0].offer.price.currency;
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
        customfield_10059: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  text: hotelAddress,
                  type: 'text'
                }
              ]
            }
          ]
        },
        customfield_10063: currency
      }
    };
  }
}
