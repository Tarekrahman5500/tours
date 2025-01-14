import Redis from 'ioredis';
import { Provider } from '@nestjs/common';
import { envVariables } from '../config';
import { redisConstants } from './redis.constants';

export const redisProvider: Provider = {
  provide: redisConstants.REDIS_CLIENT,
  useFactory: () => {
    const redis = new Redis({
      host: envVariables.REDIS_HOST,
      port: envVariables.REDIS_PORT,
      /* username: process.env.REDIS_USER,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DATABASE, 10),*/
    });

    redis.on('connect', () => console.log('Connected to Redis successfully!'));
    redis.on('error', (err) => console.error('Redis connection error:', err));

    return redis;
  },
};
