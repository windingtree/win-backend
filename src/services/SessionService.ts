import jwt from 'jsonwebtoken';
import { accessTokenKey, sessionTokenMaxAge } from '../config';
import { randomUUID } from 'crypto';
import sessionRepository from '../repositories/SessionRepository';

export class SessionService {
  public async makeSession(ip: string, userAgent: string) {
    const uuid = randomUUID();

    await sessionRepository.setSession(uuid, ip, userAgent);

    return jwt.sign(
      {
        uuid,
        ip,
        userAgent
      },
      accessTokenKey,
      {
        expiresIn: sessionTokenMaxAge
      }
    );
  }

  public validateSessionToken(sessionToken) {
    try {
      return jwt.verify(sessionToken, accessTokenKey);
    } catch (e) {
      return null;
    }
  }
}

export default new SessionService();
