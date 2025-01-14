import * as session from 'express-session';
import { RedisStore } from 'connect-redis';
import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConstants } from '../redis';
import { envVariables } from '../config';

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(
    @Inject(redisConstants.REDIS_CLIENT)
    private readonly redisClient: Redis, // Use the correct Redis type
  ) {}

  use(req: any, res: any, next: () => void) {
    const store = new RedisStore({
      client: this.redisClient, // Injected Redis client from ioredis
    });

    session({
      store,
      secret: envVariables.SESSION_SECRET_KEY,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true, // Secure cookies in production
        httpOnly: true,
        maxAge: envVariables.SESSION_EXPIRE_TIME, // Convert expiration to ms
      },
    })(req, res, next); // Attach the session middleware
  }
}
