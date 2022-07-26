import { NextFunction, Request, Response } from 'express';
import userService from '../services/UserService';
import { AppRole, AuthRequest } from '../types';
import ApiError from '../exceptions/ApiError';
import { refreshTokenMaxAge, secretTokenMaxAge } from '../config';
import { getRequestIpAddress } from '../utils';
import sessionService from '../services/SessionService';

export class UserController {
  public async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { login, password } = req.body;
      const data = await userService.login(login, password);

      res.cookie('refreshToken', data.refreshToken, {
        maxAge: refreshTokenMaxAge,
        httpOnly: true
      });

      return res.json({
        id: data.id,
        login: data.login,
        roles: data.roles,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      });
    } catch (e) {
      next(e);
    }
  }

  public async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const users = await userService.getAllUsers();

      return res.json({ users });
    } catch (e) {
      next(e);
    }
  }

  public async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const login = req.body.login;
      const password = req.body.password;
      const roles: AppRole[] = req.body.roles;

      await userService.createUser(login, password, roles);

      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }

  public async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.cookies;

      if (!refreshToken) {
        return next(ApiError.UnauthorizedError());
      }

      await userService.logout(refreshToken);

      res.clearCookie('refreshToken');

      return res.json({
        status: 'success'
      });
    } catch (e) {
      next(e);
    }
  }

  public async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.cookies;

      const data = await userService.refresh(refreshToken);

      res.cookie('refreshToken', data.refreshToken, {
        maxAge: refreshTokenMaxAge,
        httpOnly: true
      });

      return res.json({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken
      });
    } catch (e) {
      next(e);
    }
  }

  public async updateUserPassword(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    const userId = req.body.userId;
    const password = req.body.password;

    if (!req.user.roles.includes(AppRole.MANAGER) && req.user.id !== userId) {
      return next(ApiError.AccessDenied());
    }

    try {
      await userService.updateUserPassword(userId, password);

      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }

  public async updateUserRoles(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const userId: string = req.body.userId;
      const roles: AppRole[] = req.body.roles;

      await userService.updateUserRoles(userId, roles);

      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }

  public async deleteUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId: string = req.body.userId;

      await userService.deleteUser(userId);

      return res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }

  public async getSecret(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const secret = userService.getSecret();

      res.cookie('secretToken', secret, {
        maxAge: secretTokenMaxAge,
        httpOnly: true
      });

      return res.json({ secret });
    } catch (e) {
      next(e);
    }
  }

  public async walletAuth(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { chainId, signature, secret, wallet } = req.body;

      const tokens = await userService.walletAuth(
        chainId,
        signature,
        secret,
        wallet
      );

      res.cookie('refreshToken', tokens.refreshToken, {
        maxAge: refreshTokenMaxAge,
        httpOnly: true
      });

      return res.json({ ...tokens });
    } catch (e) {
      next(e);
    }
  }

  public async walletRefresh(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { refreshToken } = req.cookies;
      const tokens = await userService.walletRefresh(refreshToken);

      res.cookie('refreshToken', tokens.refreshToken, {
        maxAge: refreshTokenMaxAge,
        httpOnly: true
      });

      return res.json({ ...tokens });
    } catch (e) {
      next(e);
    }
  }

  public async makeSession(req: Request, res: Response, next: NextFunction) {
    try {
      let ip = getRequestIpAddress(req);
      let userAgent = req.header('user-agent');

      if (process.env.NODE_IS_TEST === 'true') {
        ip = '127.0.0.1';
        userAgent = 'supertest';
      }

      if (!userAgent || !ip) {
        throw ApiError.BadRequest('ip or user agent not found');
      }

      const token = await sessionService.makeSession(ip, userAgent);
      return res.json({ token });
    } catch (e) {
      next(e);
    }
  }
}

export default new UserController();
