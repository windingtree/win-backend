import { getCurrenciesTemplate } from '@windingtree/win-commons/dist/currencies';
import { CurrencyMeta } from '@windingtree/win-commons/dist/types';
import currencyRepository from '../repositories/CurrencyRepository';
import { CurrencyResponse } from '@windingtree/glider-types/dist/win';
import axios from 'axios';
import { simardJwt, simardUrl } from '../config';

export class CurrencyService {
  public async getCurrencies(): Promise<CurrencyResponse> {
    const allCurrencies = await currencyRepository.getAll();
    const currencies = {};

    allCurrencies?.forEach((v) => {
      currencies[v.code] = {
        name: v.name,
        symbol: v.symbol,
        rateFromBaseCurrency: v.rateFromBaseCurrency,
        decimals: v.decimals
      };
    });

    const response = {
      baseCurrency: 'USD',
      currencies
    };

    return response;
  }

  public async upsertCurrenciesRates(): Promise<void> {
    const currencies: CurrencyMeta = getCurrenciesTemplate();

    const rates = await this.getRates(Object.keys(currencies));
    for (const currency in currencies) {
      const rate: number = rates[currency];

      await currencyRepository.upsert({
        code: currency,
        name: currencies[currency].name,
        symbol: currencies[currency].symbol,
        rateFromBaseCurrency: rate,
        decimals: currencies[currency].decimals
      });
    }
  }

  public async getRates(
    currencies: string[]
  ): Promise<{ [k: string]: number }> {
    const rates = {};
    for (const currency of currencies) {
      const ratesData = {
        source: currency,
        target: 'USD'
      };
      try {
        const quoteRes = await axios.get(`${simardUrl}/rates`, {
          params: ratesData,
          headers: { Authorization: `Bearer ${simardJwt}` }
        });
        rates[currency] = quoteRes.data.rate;
      } catch (e) {
        // error
      }
    }

    return rates;
  }
}

export default new CurrencyService();
