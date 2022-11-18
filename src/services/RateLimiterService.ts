import { createClient, RedisClientType } from 'redis';
import { redisHost, redisPassword, redisPort, redisUsername } from '../config';
import { DateTime } from 'luxon';

type rateLimit = { attempts: number; resetTime: string };

export class RateLimiterService {
  private static _instance: RateLimiterService = new RateLimiterService();
  private redis;
  private _client: RedisClientType;

  constructor() {
    if (RateLimiterService._instance) {
      throw new Error(
        'RateLimiterService class instantiation failed. Use RateLimiterService.getInstance() instead of new operator.'
      );
    }
    RateLimiterService._instance = this;
  }

  private async getClient() {
    if (this._client) {
      return this._client;
    }

    this._client = createClient({
      url: `redis://${redisUsername}:${redisPassword}@${redisHost}:${redisPort}`
    });

    this._client.on('error', (err) => console.log('Redis Client Error', err));
    await this._client.connect();

    return this._client;
  }

  public static getInstance(): RateLimiterService {
    return RateLimiterService._instance;
  }

  public async process(
    prefix: string,
    key: string,
    minutes = 15,
    maxAttemptsCount = 100
  ): Promise<boolean> {
    const client = await this.getClient();
    const prefixKey = `rl-${prefix}::${key}`;

    const encodedValue = await client.get(prefixKey);

    if (!encodedValue) {
      await this.setDefault(prefixKey);
      return true;
    }

    const { resetTime, attempts }: rateLimit = JSON.parse(encodedValue);

    if (
      Math.abs(DateTime.fromISO(resetTime).diffNow('minutes').minutes) > minutes
    ) {
      await this.setDefault(prefixKey);
      return true;
    }

    if (attempts >= maxAttemptsCount) {
      await this.increment(prefixKey, attempts);
      return false;
    }

    await this.increment(prefixKey, attempts);
    return true;
  }

  private async setDefault(key: string): Promise<void> {
    const client = await this.getClient();

    const defaultValue: rateLimit = {
      attempts: 1,
      resetTime: DateTime.now().toISO()
    };
    await client.set(key, JSON.stringify(defaultValue));
  }

  private async increment(key: string, attempts: number) {
    const client = await this.getClient();

    const value: rateLimit = {
      attempts: attempts + 1,
      resetTime: DateTime.now().toISO()
    };
    await client.set(key, JSON.stringify(value));
  }

  public async close() {
    const client = await this.getClient();
    await client.disconnect();
  }
}
