import { AuthRequest } from '../types';
import { NextFunction, Response } from 'express';
import gitCommit from '../gitCommit';

export class HealthController {
  public async getBasicHealth(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      res.json({ success: true, commit: gitCommit.hash });
    } catch (e) {
      next(e);
    }
  }
}

export default new HealthController();
