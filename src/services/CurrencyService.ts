import { getCurrenciesTemplate } from '@windingtree/win-commons/dist/currencies';
import { CurrencyMeta } from '@windingtree/win-commons/dist/types';
import proxyService from './ProxyService';
import currencyRepository from '../repositories/CurrencyRepository';
import { CurrencyResponse } from '@windingtree/glider-types/dist/win';

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

    const rates = await proxyService.getRates(Object.keys(currencies));
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
}

export default new CurrencyService();
