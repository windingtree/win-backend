import ApiError from '../exceptions/ApiError';
import sessionService from '../services/SessionService';
import sessionRepository from '../repositories/SessionRepository';
import { sessionTokenMaxAge } from '../config';
import { getRequestIpAddress } from '../utils';

export default async (req, res, next) => {
  try {
    let { sessionToken } = req.cookies;
    if (!sessionToken) {
      let ip = getRequestIpAddress(req);
      let userAgent = req.header('user-agent');

      if (process.env.NODE_IS_TEST === 'true') {
        ip = '127.0.0.1';
        userAgent = 'supertest';
      }

      sessionToken = await sessionService.makeSession(ip, userAgent);

      res.cookie('sessionToken', sessionToken, {
        maxAge: sessionTokenMaxAge,
        httpOnly: true
      });
    }

    const data = sessionService.validateSessionToken(sessionToken);

    if (!data || !data.uuid) {
      return next(ApiError.UnauthorizedError());
    }

    if (!(await sessionRepository.getSession(data.uuid))) {
      return next(ApiError.UnauthorizedError());
    }

    req.sessionId = data.uuid;

    next();
  } catch (e) {
    return next(ApiError.UnauthorizedError());
  }
};
