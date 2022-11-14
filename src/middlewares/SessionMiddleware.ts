import ApiError from '../exceptions/ApiError';
import sessionService from '../services/SessionService';
import sessionRepository from '../repositories/SessionRepository';
import { sessionTokenMaxAge } from '../config';
import { getRequestIpAddress } from '../utils';
import { NextFunction, Response } from 'express';
import { SessionRequest } from '../types';

export default async (
  req: SessionRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let { sessionToken } = req.cookies;
    let ip = getRequestIpAddress(req);
    let userAgent = req.header('user-agent');

    if (!sessionToken) {
      if (process.env.NODE_IS_TEST === 'true') {
        ip = '127.0.0.1';
        userAgent = 'supertest';
      }

      sessionToken = await createSession(res, ip, userAgent || '');
    }

    let data = sessionService.validateSessionToken(sessionToken);

    if (!data || !data.uuid) {
      return next(ApiError.UnauthorizedError());
    }

    if (!(await sessionRepository.getSession(data.uuid))) {
      sessionToken = await createSession(res, ip, userAgent || '');
      data = sessionService.validateSessionToken(sessionToken);
    }

    req.sessionId = data.uuid;

    next();
  } catch (e) {
    return next(ApiError.UnauthorizedError());
  }
};

const createSession = async (res: Response, ip: string, userAgent: string) => {
  const sessionToken = await sessionService.makeSession(ip, userAgent);

  res.cookie('sessionToken', sessionToken, {
    maxAge: sessionTokenMaxAge,
    httpOnly: true,
    sameSite: 'none',
    secure: true
  });

  return sessionToken;
};
