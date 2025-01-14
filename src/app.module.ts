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
import { RedisModule } from './redis';

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
    UserModule,
    RedisModule,
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
    consumer.apply(SessionMiddleware).forRoutes('*'); // Apply session middleware globally
  }
}
