import { getCurrenciesTemplate } from '@windingtree/win-commons/dist/currencies';
import { CurrencyMeta } from '@windingtree/win-commons/dist/types';
import proxyService from './ProxyService';
import currencyRepository from '../repositories/CurrencyRepository';
import { CurrencyResponse } from '@windingtree/glider-types/dist/win';

export class CurrencyService {
  public async getCurrencies(): Promise<CurrencyResponse> {
    const currencies = await currencyRepository.getAll();
    const currenciesMap: CurrencyResponse = {};

    currencies?.forEach((v) => {
      currenciesMap[v.code] = {
        name: v.name,
        symbol: v.symbol,
        rateFromBaseCurrency: v.rateFromBaseCurrency,
        decimals: v.decimals
      };
    });

    return currenciesMap;
  }

  public async upsertCurrenciesRates(): Promise<void> {
    const currencies: CurrencyMeta = getCurrenciesTemplate();
    console.log(currencies);
    const rates = await proxyService.getRates(Object.keys(currencies));
    for (const currency in currencies) {
      const rate: number = rates[currency];

      if (currency !== 'USD') {
        console.log(currency);
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
}

export default new CurrencyService();
