import circleToPolygon from 'circle-to-polygon';
import { PassengerBooking } from '@windingtree/glider-types/dist/accommodations';
import { Quote } from '@windingtree/glider-types/dist/simard';
import { regexp } from '@windingtree/org.id-utils';
import { utils } from 'ethers';
import { DateTime } from 'luxon';
import cc from 'currency-codes';
import { appEnvironment, simardJwt, simardUrl } from './config';
import axios from 'axios';
import Big from 'big.js';

export const makeCircumscribedSquare: (
  lon: number,
  lat: number,
  radius: number
) => { east: number; south: number; north: number; west: number } = (
  lon: number,
  lat: number,
  radius: number
) => {
  const coordinates = [lon, lat]; //center of circle
  const squareSideLength = radius / (Math.sqrt(2) / 2); // in meters
  const numberOfEdges = 8; // for make square

  const polygon = circleToPolygon(coordinates, squareSideLength, numberOfEdges);

  const coords = polygon.coordinates[0];

  const uncertainty = 0.0001; // in radians ~30 meters

  return {
    east: coords[1][0] + uncertainty,
    south: coords[1][1] + uncertainty,
    west: coords[5][0] - uncertainty,
    north: coords[5][1] - uncertainty
  };
};

export const parseEmailAddress = (passengers: {
  [key: string]: PassengerBooking;
}): string => {
  if (!passengers.PAX1 || !passengers.PAX1.contactInformation) {
    return '';
  }
  let emailAddress = '';
  for (const contactInfo of passengers.PAX1.contactInformation) {
    if (contactInfo != '' && contactInfo.match(regexp.email)) {
      emailAddress = contactInfo;
    }
  }
  return emailAddress;
};

export const getRequestIpAddress = (request) => {
  const IP_HEADERS = [
    'Forwarded',
    'Forwarded-For',
    'X-Forwarded',
    'X-Forwarded-For', // may contain multiple IP addresses in the format: 'client IP, proxy 1 IP, proxy 2 IP' - we use first one
    'X-Client-IP',
    'X-Real-IP', // Nginx proxy, FastCGI
    'X-Cluster-Client-IP', // Rackspace LB, Riverbed Stingray
    'Proxy-Client-IP',
    'CF-Connecting-IP', // Cloudflare
    'Fastly-Client-Ip', // Fastly CDN and Firebase hosting header when forwared to a cloud function
    'True-Client-Ip', // Akamai and Cloudflare
    'WL-Proxy-Client-IP',
    'HTTP_X_FORWARDED_FOR',
    'HTTP_X_FORWARDED',
    'HTTP_X_CLUSTER_CLIENT_IP',
    'HTTP_CLIENT_IP',
    'HTTP_FORWARDED_FOR',
    'HTTP_FORWARDED',
    'HTTP_VIA',
    'REMOTE_ADDR'
  ];

  const headers = request.headers;
  for (const header of IP_HEADERS) {
    const value = headers[header];
    if (value) {
      const parts = value.split(/\s*,\s*/g);
      return parts[0] ?? null;
    }
  }
  const client = request.connection ?? request.socket ?? request.info;
  if (client) {
    return client.remoteAddress ?? null;
  }
  return null;
};

export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const getContractServiceId = (offerId: string): string => {
  return utils.id(offerId);
};

export const formatEmailDate = (date: Date): string => {
  return DateTime.fromJSDate(date).toFormat('EEE, MMM dd, yyyy', {
    locale: 'en'
  });
};

export const getCurrencyDecimals = (currency: string): number => {
  // get number of currency decimals - default to 2
  let decimals = cc.code(currency)!.digits;
  if (!decimals) {
    // use a default of 2 if undefined
    decimals = 2;
  }
  return decimals;
};

export const convertAmount = async (
  sourceAmount: string,
  sourceCurrency: string,
  targetCurrency: string
): Promise<Quote> => {
  if (appEnvironment === 'development') {
    const rate = '0.5';
    return {
      quoteId: 'abc',
      sourceCurrency: sourceCurrency,
      sourceAmount: sourceAmount,
      targetCurrency: targetCurrency,
      targetAmount: new Big(sourceAmount)
        .mul(rate)
        .toFixed(getCurrencyDecimals(targetCurrency)),
      rate: rate
    };
  }

  const quoteData = {
    sourceCurrency,
    sourceAmount,
    targetCurrency
  };

  const quoteRes = await axios.post(`${simardUrl}/quotes`, quoteData, {
    headers: { Authorization: `Bearer ${simardJwt}` }
  });

  return quoteRes.data;
};
