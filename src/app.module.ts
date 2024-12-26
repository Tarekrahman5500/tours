import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserController, UserModule, UserService } from './user';

import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter } from './error/allExceptionsFilter';

@Module({
  imports: [UserModule],
  controllers: [AppController, UserController],
  providers: [
    AppService,
    UserService,
    {
      provide: APP_FILTER,
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
export class AppModule {}
