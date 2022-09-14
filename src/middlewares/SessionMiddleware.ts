import ApiError from '../exceptions/ApiError';
import sessionService from '../services/SessionService';
import sessionRepository from '../repositories/SessionRepository';

export default async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next(ApiError.UnauthorizedError());
    }

    const sessionToken = authHeader.split(' ')[1];
    if (!sessionToken) {
      return next(ApiError.UnauthorizedError());
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
