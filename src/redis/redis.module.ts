import { Module, Global } from '@nestjs/common';
import { redisProvider } from './redis.provider';
import { redisConstants } from './redis.constants';

@Global()
@Module({
  providers: [redisProvider],
  exports: [redisConstants.REDIS_CLIENT],
})
export class RedisModule {}
