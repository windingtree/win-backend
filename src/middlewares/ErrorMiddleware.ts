import ApiError from '../exceptions/ApiError';
import { NextFunction, Request, Response } from 'express';
import LogService from '../services/LogService';
import { debugEnabled } from '../config';
import { MetricsService } from '../services/MetricsService';

export default (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ApiError) {
    if (debugEnabled) {
      LogService.yellow(`Handle error: ${err.message}`);
    }
    return res.status(err.status).json({
      success: false,
      message: err.message,
      ...(debugEnabled
        ? {
            errors: err.errors
          }
        : {})
    });
  }
  if (debugEnabled) {
    LogService.obj(err);
  }

  MetricsService.fatalErrorCounter.inc();

  return res
    .status(500)
    .json({ success: false, message: err.message || 'Something went wrong' });
};
