import { Request, Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  AccommodationType,
  CheckInOutPolicy,
  ContactInformation,
  Media,
  Offer,
  Price,
  PriceItem,
  PricePlanReferences,
  RoomTypes,
  SearchResponse
} from '@windingtree/glider-types/types/derbysoft';
import { NetworkInfo } from './config';

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

export interface MongoLocation {
  type: string;
  coordinates: number[];
}

export interface Hotel {
  _id?: ObjectId;
  id: string;
  hotelId: string;
  provider: string;
  createdAt: Date;
  name: string;
  type: AccommodationType;
  description: string;
  location: MongoLocation;
  rating: number;
  contactInformation: ContactInformation;
  checkinoutPolicy: CheckInOutPolicy;
  otherPolicies: string[];
  media: Media;
  roomTypes: {
    [k: string]: RoomTypes;
  };
}

export interface OfferDBValue {
  _id?: ObjectId;
  id: string;
  accommodation: Hotel;
  pricedItems?: PriceItem[];
  disclosures?: string[];
  price?: Price;
  pricePlansReferences?: PricePlanReferences;
  expiration: Date;
  arrival: Date;
  departure: Date;
}

export interface PricedOfferData extends Offer {
  accommodation: Hotel;
}

export interface DerbySoftData {
  data: SearchResponse | PricedOfferData | Record<string, string>;
  status: string;
  message?: string;
}

export type DealStatus = 'paid' | 'pending' | 'booked' | 'paymentError';

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
  message?: string;
}

export interface DealDTO {
  offer: OfferDBValue;
  offerId: string;
  createdAt: Date;
  status: DealStatus;
  message?: string;
  orderId?: string;
}

export type RouterInitializer = (router: Router) => void;
