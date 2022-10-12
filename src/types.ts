import { Request, Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  PassengerBooking,
  PassengerSearch
} from '@windingtree/glider-types/dist/accommodations';
import {
  MongoLocation,
  OfferDbValue,
  OrganizerInformation,
  RewardType,
  GroupBookingDeposits,
  PricePlan,
  WinAccommodation,
  PriceItem,
  Disclosures,
  Price,
  PricePlansReferences,
  Expiration
} from '@windingtree/glider-types/dist/win';
import { NetworkInfo } from '@windingtree/win-commons/dist/types';
import { Quote } from '@windingtree/glider-types/dist/simard';
import { CreatedIssue } from 'jira.js/out/version3/models';

export interface User {
  login: string;
  password: string;
  roles: AppRole[];
}

export interface UserDbData extends User {
  _id: ObjectId | null;
}

export interface UserDTO {
  id: string;
  login: string;
  roles: AppRole[];
}

export enum AppRole {
  MANAGER = 'manager',
  STAFF = 'staff'
}

export interface Token {
  createdAt: Date;
  userId: string;
  refresh: string;
}

export interface TokenDbData extends Token {
  _id: ObjectId | null;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface SessionDbData extends Session {
  _id: ObjectId | null;
}

export interface Session {
  uuid: string;
  ip: string;
  userAgent: string;
  expiredAt: Date;
}

export interface UserRequestDbData extends UserRequest {
  _id: ObjectId | null;
}

export interface UserRequest {
  sessionId: string;
  accommodationId: string;
  provider: string;
  providerAccommodationId: string;
  hotelLocation: MongoLocation;
  startDate: Date;
  requestBody: SearchBody;
  requestHash: string;
}

//todo rename
export interface OfferBackEnd {
  _id?: string;
  id: string;
  accommodation: WinAccommodation;
  pricedItems: PriceItem[];
  disclosures: Disclosures;
  price: Price;
  pricePlansReferences: PricePlansReferences;
  expiration: Date;
  arrival: string;
  departure: string;
  provider: string;
  accommodationId: string;
  requestHash: string;
  sessionId: string;
  pricePlan: PricePlan;
  quote?: Quote;
}

export interface AuthRequest extends Request {
  user: UserDTO;
}

export interface WalletRequest extends Request {
  walletAddress: string;
}

export interface SessionRequest extends Request {
  sessionId: string;
}

export enum State {
  UNINITIALIZED,
  PAID,
  REFUNDED
}

export interface DealStorage {
  provider: string;
  customer: string;
  asset: string;
  value: string;
  state: State;
}

export interface Location {
  lon: number;
  lat: number;
  radius: number;
}

export interface SearchBody {
  accommodation: {
    location: Location;
    arrival: string;
    departure: string;
    roomCount?: number;
  };
  passengers: [PassengerSearch, ...PassengerSearch[]];
}

export type DealStatus =
  | 'paid'
  | 'pending'
  | 'booked'
  | 'paymentError'
  | 'transactionError'
  | 'creationFailed'
  | 'cancelled';

export interface DealDBValue {
  _id?: ObjectId;
  offer: OfferBackEnd;
  dealStorage: DealStorage;
  contract: NetworkInfo;
  offerId: string;
  userAddress: string[];
  status: DealStatus;
  createdAt: Date;
  orderId?: string;
  supplierReservationId?: string;
  message?: string;
  rewardOption?: RewardType;
  userEmailAddress?: string;
}

export interface DealDTO {
  offer: OfferBackEnd;
  offerId: string;
  createdAt: Date;
  status: DealStatus;
  message?: string;
  orderId?: string;
  supplierReservationId?: string;
  rewardOption?: RewardType;
  // userEmailAddress is voluntarily not in the DTO for now.
}

export type RouterInitializer = (router: Router) => void;

export type HotelProviders = 'derbySoft' | 'amadeus';

export type DealWorkerData = {
  id: string;
  passengers: { [key: string]: PassengerBooking };
};

export type DealType = 'Standard' | 'Group';

export type RewardWorkerData = {
  id: string;
  dealType: DealType;
  rewardType: RewardType;
};

export interface GroupRoom {
  quantity: number;
  offer: OfferBackEnd;
}

// These are the steps of a deal in this order
export type GroupBookingRequestStatus =
  | 'pending'
  | 'dealError'
  | 'depositPaid'
  | 'stored'
  | 'ticketCreated'
  | 'ticketStored'
  | 'emailSent'
  | 'complete';

export interface GroupBookingRequestDBValue {
  _id?: ObjectId;
  requestId: string;
  contact: OrganizerInformation;
  createdAt?: Date;
  guestsCount: number;
  rooms: GroupRoom[];
  invoice: boolean;
  totals: GroupBookingDeposits; // Used to compute the rewards.
  depositOptions: GroupBookingDeposits;
  status: GroupBookingRequestStatus;
  serviceId: string;
  jiraTicket?: CreatedIssue;
  dealStorage?: DealStorage;
  blockchainUserAddresses?: string[];
  contract?: NetworkInfo;
  organizerBlockchainAddress?: string[];
  errorMessage?: string;
  rewardOption?: RewardType;
}

export interface PaymentInfo {
  paidCurrency: string;
  networkInfo: NetworkInfo;
  dealStorage: DealStorage;
  blockchainUserAddresses: string[];
}
