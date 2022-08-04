import { AuthRequest } from '../types';
import { NextFunction, Response } from 'express';
import gitCommit from 'src/gitCommit';

export class HealthController {
  public async getBasicHealth(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      console.log('we are here');
      res.json({ success: true, commit: gitCommit.hash });
    } catch (e) {
      next(e);
    }
  }
}

export default new HealthController();
