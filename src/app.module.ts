import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserController, UserModule } from './user';

import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter } from './error/allExceptionsFilter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { configConstants, envConfiguration } from './config';
import typeorm from './config/typeorm';
import { SessionMiddleware } from './middleware';
import { redisConstants, RedisModule } from './redis';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheStore } from '@nestjs/common/cache';
import { AuthModule } from './auth/auth.module';
import * as redisStore from 'cache-manager-ioredis';
import { PassportModule } from '@nestjs/passport';
import * as passport from 'passport';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [typeorm, envConfiguration],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        // const validateEnv = configService.get(configConstants.ENVIRONMENT);
        // console.log('TypeORM Configuration:', database, validateEnv); // Log the configuration to debug
        return configService.get(configConstants.TYPEORM);
      },
    }),
    PassportModule.register({ session: true }), // Enable session support
    AuthModule, // Import your authentication module
    UserModule,
    RedisModule,
    CacheModule.registerAsync({
      imports: [RedisModule], // Import the custom Redis module
      inject: [redisConstants.REDIS_CLIENT], // Inject the Redis client provided by the Redis module
      useFactory: async (redisClient) => {
        return {
          store: redisStore,
          client: redisClient, // Use the injected Redis client
          ttl: 5 * 60000, // Set default TTL in seconds
        } as unknown as CacheStore; // Type assertion for compatibility
      },
    }),
  ],
  controllers: [AppController, UserController],
  providers: [
    AppService,
    UserModule,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    /* {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },*/
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    /*{
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) => {
        return new ClassSerializerInterceptor(reflector);
      },
      inject: [Reflector],
    },*/
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionMiddleware).forRoutes('*');
    // Then apply passport middleware to handle authentication session
    consumer.apply(passport.initialize()).forRoutes('*');
    consumer.apply(passport.session()).forRoutes('*');
  }
}
