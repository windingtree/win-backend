import { Request, Router } from 'express';
import { ObjectId } from 'mongodb';
import {
  AccommodationType,
  CheckInOutPolicy,
  ContactInformation,
  Media,
  OfferResult,
  Price,
  PricedOffer,
  PriceItem,
  Roomtypes,
  SearchResults
} from '@windingtree/glider-types/types/derbysoft';

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
    [k: string]: Roomtypes;
  };
}

export interface OfferDBValue extends SearchResults, OfferResult {
  _id?: ObjectId;
  id: string;
  accommodation: Hotel;
  pricedItems?: PriceItem[];
  disclosures?: string[];
  price?: Price;
}

export interface PricedOfferData extends PricedOffer {
  accommodation: Hotel;
}

export interface DerbySoftData {
  data: SearchResults | PricedOfferData;
  status: string;
  message?: string;
}

export type RouterInitializer = (router: Router) => void;
