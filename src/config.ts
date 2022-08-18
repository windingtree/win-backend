import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { NetworkMode } from '@windingtree/win-commons/dist/types';
dotenv.config();

export const checkEnvVariables = (vars: string[]): void =>
  vars.forEach((variable) => {
    if (!process.env[variable] || process.env[variable] === '') {
      throw new Error(`${variable} must be provided in the ENV`);
    }
  });

checkEnvVariables([
  'PORT',
  'APP_ACCESS_TOKEN_KEY',
  'APP_REFRESH_TOKEN_KEY',
  'APP_PROMETHEUS_PORT',
  'APP_VERSION',
  'MONGODB_URL',
  'DB_NAME',
  'DERBYSOFT_PROXY_URL',
  'CLIENT_JWT',
  'SIMARD_JWT',
  'SIMARD_ORG_ID',
  'SIMARD_URL',
  'SENDGRID_API_KEY',
  'SENDGRID_EMAIL_FROM',
  'SENDGRID_EMAIL_TEMPLATE_ID',
  'NETWORK_MODE'
]);

export const port = Number(process.env.PORT);
export const accessTokenKey = String(process.env.APP_ACCESS_TOKEN_KEY);
export const refreshTokenKey = String(process.env.APP_REFRESH_TOKEN_KEY);
export const debugEnabled = Boolean(process.env.DEBUG_LPMS_SERVER === 'true');
export const prometheusEnabled = Boolean(
  process.env.PROMETHEUS_ENABLED === 'true'
);
export const prometheusPort = Number(process.env.APP_PROMETHEUS_PORT);
export const refreshTokenMaxAge = 30 * 24 * 60 * 60 * 1000; //30d
export const accessTokenMaxAge = 30 * 60 * 1000; //30m
export const secretTokenMaxAge = 5 * 60 * 1000; //5m
export const mongoDBUrl = String(process.env.MONGODB_URL);
export const DBName = String(process.env.DB_NAME);
export const derbySoftProxyUrl = String(process.env.DERBYSOFT_PROXY_URL);
export const clientJwt = String(process.env.CLIENT_JWT);
export const clientUrl = String(process.env.CLIENT_URL);
export const simardJwt = String(process.env.SIMARD_JWT);
export const simardOrgId = String(process.env.SIMARD_ORG_ID);
export const simardUrl = String(process.env.SIMARD_URL);
export const sendgridApiKey = String(process.env.SENDGRID_API_KEY);
export const sendgridEmailFrom = String(process.env.SENDGRID_EMAIL_FROM);
export const sendgridEmailTo = String(process.env.SENDGRID_EMAIL_TO || '');
export const sendgridEmailTemplateId = String(
  process.env.SENDGRID_EMAIL_TEMPLATE_ID
);
export const defaultRadius = 2000; //in meters
export const allowLocalhostUI = Boolean(
  process.env.ALLOW_LOCALHOST_UI === 'true'
);
export const networkMode = String(process.env.NETWORK_MODE) as NetworkMode;

export const assetsCurrencies = ['EUR', 'USD', 'JPY', 'CNY']; // currency the asset is pegged to
export type AssetCurrency = typeof assetsCurrencies[number];

export interface CryptoAsset {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  image: string;
  native: boolean;
  permit: boolean;
  currency: AssetCurrency;
}

export interface Network {
  name: string;
  chainId: number;
}

export interface NetworkInfo extends Network {
  currency: string;
  decimals: number;
  rpc: string;
  contracts: {
    ledger: string;
    winPay: string;
    assets: CryptoAsset[];
  };
  blockExplorer: string;
}

const encodedWallet =
  '{"address":"b7f3f36d83924aecbb50c180ad33a3642166936e","id":"bb16c9df-b5bf-453c-ae6d-a02fc548d9c3","version":3,"Crypto":{"cipher":"aes-128-ctr","cipherparams":{"iv":"5c6f6830e15bfb3d414df302568f7708"},"ciphertext":"3c8b3d26e385ef98f89d03f9ba2339a7322cf88c5e9a2978a1954a82cae709ef","kdf":"scrypt","kdfparams":{"salt":"4149546ebebcaf13f6c9402372148cc63aef2716196ea4d144a417a526df7204","n":131072,"dklen":32,"p":1,"r":8},"mac":"5f769679ceae95c75a86d4fbd1823889d060c2d00c3cf317a7acb8351052abe2"},"x-ethers":{"client":"ethers.js","gethFilename":"UTC--2022-08-15T10-31-14.0Z--b7f3f36d83924aecbb50c180ad33a3642166936e","mnemonicCounter":"72aa34f8659338b7fd558ee61ba09507","mnemonicCiphertext":"5d9650d0b1ebe68da003e591107417fe","path":"m/44\'/60\'/0\'/0/0","locale":"en","version":"0.1"}}';
const encodeWalletSalt = 'salt';
export const testWallet = ethers.Wallet.fromEncryptedJson(
  encodedWallet,
  encodeWalletSalt
);
