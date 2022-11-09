import circleToPolygon from 'circle-to-polygon';
import { PassengerBooking } from '@windingtree/glider-types/dist/accommodations';
import { Quote } from '@windingtree/glider-types/dist/simard';
import { regexp } from '@windingtree/org.id-utils';
import { utils } from 'ethers';
import { DateTime } from 'luxon';
import cc, { CurrencyCodeRecord } from 'currency-codes';
import { simardJwt, simardUrl } from './config';
import axios from 'axios';
import Big from 'big.js';
import { ProviderAwareIdentifier } from './types';

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
  const currencyRecord: CurrencyCodeRecord | undefined = cc.code(currency);
  if (currencyRecord && currencyRecord.digits) {
    return currencyRecord.digits;
  } else {
    return 2;
  }
};

export const convertAmount = async (
  targetAmount: string,
  targetCurrency: string,
  sourceCurrency: string
): Promise<Quote> => {
  if (process.env.NODE_IS_TEST === 'true') {
    const rate = '0.5';
    return {
      quoteId: 'abc',
      sourceCurrency: sourceCurrency,
      sourceAmount: new Big(targetAmount)
        .mul(rate)
        .toFixed(getCurrencyDecimals(targetCurrency)),
      targetCurrency: targetCurrency,
      targetAmount: targetAmount,
      rate: rate
    };
  }

  const quoteData = {
    sourceCurrency,
    targetAmount,
    targetCurrency
  };

  const quoteRes = await axios.post(`${simardUrl}/quotes`, quoteData, {
    headers: { Authorization: `Bearer ${simardJwt}` }
  });

  return quoteRes.data;
};

const utf8ToHex = (str: string): string => {
  str = str || '';
  return `0x${Buffer.from(str, 'utf8').toString('hex')}`;
};
const hexToUTF8 = (str: string): string => {
  str = str || '';
  if (str.startsWith('0x')) {
    str = str.substring(2);
  }
  return `${Buffer.from(str, 'hex').toString('utf8')}`;
};

export const encodeProviderId = (
  providerName: string,
  uniqueID: string,
  separator = ':'
): string => {
  return encodeProviderIdWithType(
    { providerName: providerName, uniqueId: uniqueID },
    separator
  );
};
export const encodeProviderIdWithType = (
  id: ProviderAwareIdentifier,
  separator = ':'
): string => {
  if (!id) {
    throw new Error('Invalid ID parameter');
  }
  const { providerName, uniqueId } = id;
  let concat = `${providerName}${separator}${uniqueId}`;
  if (concat.length < 31) {
    concat = String(concat + separator).padEnd(32, ' ');
  }
  return utf8ToHex(concat);
};

export const decodeProviderId = (
  hexifiedId: string,
  separator = ':'
): ProviderAwareIdentifier => {
  const decoded = hexToUTF8(hexifiedId).split(separator);
  if (decoded.length < 2) {
    throw new Error('Unable to decode provider ID');
  }
  return {
    providerName: decoded[0],
    uniqueId: decoded[1]
  };
};
