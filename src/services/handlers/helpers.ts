import { SearchBody } from '../../types';

export type HandlerServiceConfig = {
  provider: string;
  searchBody: SearchBody;
  requestHash: string;
  sessionId: string;
};
