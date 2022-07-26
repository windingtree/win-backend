import jwt from 'jsonwebtoken';
import {
  accessTokenKey,
  accessTokenMaxAge,
  refreshTokenKey,
  refreshTokenMaxAge
} from '../config';
import { Tokens } from '../types';
import tokenRepository, {
  TokenRepository
} from '../repositories/TokenRepository';

export class TokenService {
  private repository: TokenRepository;

  constructor() {
    this.repository = tokenRepository;
  }

  public generateTokens(payload): Tokens {
    const accessToken = jwt.sign(payload, accessTokenKey, {
      expiresIn: accessTokenMaxAge
    });
    const refreshToken = jwt.sign(payload, refreshTokenKey, {
      expiresIn: refreshTokenMaxAge
    });

    return {
      accessToken,
      refreshToken
    };
  }

  public generateSecretToken(payload): string {
    return jwt.sign(payload, accessTokenKey, {
      expiresIn: accessTokenMaxAge
    });
  }

  public async saveToken(refreshToken: string, userId: string) {
    return await this.repository.setUserToken(userId, refreshToken);
  }

  public async revokeToken(token: string) {
    const data = jwt.verify(token, refreshTokenKey);
    const userId = data.id;
    const tokens = await this.repository.getUserTokens(userId);
    const neededToken = tokens.find((t) => token === t.refresh);

    if (neededToken && neededToken._id) {
      return await this.repository.delTokens([neededToken._id.toString()]);
    }
  }

  public async revokeAllUserTokens(userId: string) {
    return await this.repository.delUserTokens(userId);
  }

  public validateRefreshToken(refreshToken) {
    try {
      return jwt.verify(refreshToken, refreshTokenKey);
    } catch (e) {
      return null;
    }
  }

  public validateAccessToken(accessToken) {
    try {
      return jwt.verify(accessToken, accessTokenKey);
    } catch (e) {
      return null;
    }
  }

  public async checkRefreshInDB(token): Promise<boolean> {
    try {
      const data = jwt.verify(token, refreshTokenKey);
      const userId = data.id;
      const tokens = await this.repository.getUserTokens(userId);
      return Boolean(tokens.find((t) => token === t.refresh));
    } catch (e) {
      return false;
    }
  }
}

export default new TokenService();
