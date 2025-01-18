import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { configConstants } from './config';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  // Initialize Passport middleware globally
  /*app.use(SessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session()); // Passport session middleware*/
  app.setGlobalPrefix('/api/v1/');
  await app.listen(configService.get(configConstants.ENVIRONMENT).PORT);
}
bootstrap();
