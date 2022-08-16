import ApiError from '../exceptions/ApiError';
import tokenService from '../services/TokenService';
import { utils } from 'ethers';

export default async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next(ApiError.UnauthorizedError());
    }

    const accessToken = authHeader.split(' ')[1];
    if (!accessToken) {
      return next(ApiError.UnauthorizedError());
    }

    const data = tokenService.validateAccessToken(accessToken);

    if (!data || !utils.isAddress(data.id)) {
      return next(ApiError.UnauthorizedError());
    }

    req.walletAddress = data.id;

    next();
  } catch (e) {
    return next(ApiError.UnauthorizedError());
  }
};
