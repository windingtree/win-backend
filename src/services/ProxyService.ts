import axios from 'axios';
import { clientJwt, derbysoftProxyUrl } from '../config';

interface HotelResponse {
  data: Array<unknown>;
  status: string;
}

interface SearchRectangle {
  south: number;
  west: number;
  north: number;
  east: number;
}

export class ProxyService {
  public async getAllHotels(): Promise<HotelResponse> {
    const res = await axios.get(`${derbysoftProxyUrl}/hotels`, {
      headers: { Authorization: `Bearer ${clientJwt}` }
    });

    return res.data;
  }

  public async getHotelsByRectangle(
    rectangle: SearchRectangle
  ): Promise<HotelResponse> {
    const res = await axios.post(
      `${derbysoftProxyUrl}/hotels/search`,
      { location: { rectangle } },
      { headers: { Authorization: `Bearer ${clientJwt}` } }
    );

    return res.data;
  }
}

export default new ProxyService();
