import { Request, Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  PassengerBooking,
  PassengerSearch
} from '@windingtree/glider-types/dist/accommodations';
import {
  RewardType,
  OfferDbValue,
  OrganizerInformation,
  GroupBookingDeposit
} from '@windingtree/glider-types/dist/win';
import { NetworkInfo } from '@windingtree/win-commons/dist/types';
import { Quote } from '@windingtree/glider-types/dist/simard';

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
export interface OfferBackEnd extends OfferDbValue {
  accommodationId: string;
  requestHash: string;
  sessionId: string;
  quote?: Quote;
}

export interface AuthRequest extends Request {
  user: UserDTO;
}

//todo rename
export interface OfferBackEnd extends OfferDbValue {
  accommodationId: string;
  requestHash: string;
  sessionId: string;
  quote?: Quote;
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
  offer: OfferDbValue;
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

export interface GroupRoom {
  quantity: number;
  offer: OfferDbValue;
}

export type GroupBookingRequestStatus = 'paid' | 'pending';

export interface GroupBookingRequestDBValue {
  _id?: ObjectId;
  contact: OrganizerInformation;
  createdAt: Date;
  guestsCount: number;
  rooms: GroupRoom[];
  invoice: boolean;
  deposit: GroupBookingDeposit;
  requestId: string;
  status: GroupBookingRequestStatus;
  dealStorage?: DealStorage;
  contract?: NetworkInfo;
  organizerBlockchainAddress?: string[];
}
