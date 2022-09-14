import { Request, Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  PassengerBooking,
  PassengerSearch,
  Price,
  PriceItem,
  PricePlanReferences
} from '@windingtree/glider-types/types/derbysoft';
import {
  Accommodation,
  Disclosures,
  RewardType
} from '@windingtree/glider-types/types/win';
import { NetworkInfo } from '@windingtree/win-commons/dist/types';

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

export interface AuthRequest extends Request {
  user: UserDTO;
}

export interface WalletRequest extends Request {
  walletAddress: string;
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

export interface OfferDBValue {
  _id?: ObjectId;
  id: string;
  accommodation: Accommodation;
  accommodationId: string;
  pricedItems?: PriceItem[];
  disclosures?: Disclosures;
  price: Price;
  pricePlansReferences: PricePlanReferences;
  expiration: Date;
  arrival: Date;
  departure: Date;
  provider: HotelProviders;
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
  offer: OfferDBValue;
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
  offer: OfferDBValue;
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
