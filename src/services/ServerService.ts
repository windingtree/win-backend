import { Server as HttpServer } from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import router from '../router/index';
import { Express } from 'express-serve-static-core';
import errorMiddleware from '../middlewares/ErrorMiddleware';
import { allowLocalhostUI, clientUrl, debugEnabled } from '../config';
import responseTime from 'response-time';
import { MetricsService } from './MetricsService';
import * as openApiValidator from 'express-openapi-validator';
import path from 'path';
import { validationMiddleware } from '../middlewares/ValidationMiddleware';

export default class ServerService {
  protected PORT: number;
  protected app: Express;
  protected server: HttpServer;

  constructor(port: number) {
    this.PORT = port;
    this.app = express();
    this.bootstrap();
  }

  private bootstrap() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());

    // CORS
    let origins;
    if (allowLocalhostUI) {
      origins = [clientUrl, 'http://localhost:3000', 'https://localhost:3000'];
    } else {
      origins = clientUrl;
    }
    const corsOptions = {
      origin: origins,
      optionsSuccessStatus: 200,
      methods: 'GET,PUT,POST,DELETE,PATCH,OPTIONS',
      allowedHeaders:
        'Origin,X-Requested-With,Content-Type,Accept,Authorization',
      exposedHeaders: 'Content-Range,X-Content-Range',
      credentials: true
    };
    this.app.use(cors(corsOptions));

    // Security middleware
    this.app.set('trust proxy', 1);
    this.app.disable('x-powered-by');
    this.app.use(helmet());
    this.app.use(helmet.contentSecurityPolicy());
    this.app.use(helmet.crossOriginEmbedderPolicy());
    this.app.use(helmet.crossOriginOpenerPolicy());
    this.app.use(helmet.crossOriginResourcePolicy());
    this.app.use(helmet.dnsPrefetchControl());
    this.app.use(helmet.expectCt());
    this.app.use(helmet.frameguard());
    this.app.use(helmet.hidePoweredBy());
    this.app.use(helmet.hsts());
    this.app.use(helmet.ieNoOpen());
    this.app.use(helmet.noSniff());
    this.app.use(helmet.originAgentCluster());
    this.app.use(helmet.permittedCrossDomainPolicies());
    this.app.use(helmet.referrerPolicy());
    this.app.use(helmet.xssFilter());

    this.app.use(
      responseTime((request: Request, response: Response, time: number) => {
        if (request?.route?.path) {
          MetricsService.restResponseTimeHistogram.observe(
            {
              method: request.method,
              route: request.route.path,
              status_code: response.statusCode
            },
            time / 1000
          ); //in seconds
        }
      })
    );

    if (debugEnabled) {
      const morganLogger = morgan(function (tokens, req, res) {
        const method = tokens.method(req, res) || '';
        const url = tokens.url(req, res) || '';
        const status = tokens.status(req, res) || '';
        const contentLength = tokens.res(req, res, 'content-length') || '';
        const responseTime = tokens['response-time'](req, res) || '';

        if (url.match(/api\/health/gi)) {
          // we don't want to show route info for `api/health` end-point
          // `api/health` end-point is constantly being checked on `test` and `prod` environments
          // we want a nice short logs, so skip `api/health`
          return;
        }

        return [
          method,
          url,
          status,
          contentLength,
          '-',
          responseTime,
          'ms'
        ].join(' ');
      });
      this.app.use(morganLogger);
    }

    const apiSpec = path.join(
      path.resolve(),
      'node_modules/@windingtree/glider-types/dist/win.yaml'
    );

    this.app.use(
      openApiValidator.middleware({
        apiSpec
        //validateResponses: true
      })
    );

    this.app.use(validationMiddleware);

    this.app.use('/api', router);

    this.app.use(errorMiddleware);
  }

  get getApp(): Express {
    return this.app;
  }

  async start(): Promise<HttpServer> {
    return await new Promise((resolve, reject) => {
      try {
        const server = this.server;
        this.server = this.app.listen(this.PORT, () => {
          console.log(`Server started on PORT = ${this.PORT}`);
          resolve(server);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async stop(): Promise<unknown> {
    return new Promise((resolve, reject) => {
      try {
        this.server.once('close', resolve);
        this.server.close();
      } catch (e) {
        reject(e);
      }
    });
  }
}
