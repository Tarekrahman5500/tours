import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';
import { configConstants } from './config';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    const database = this.configService.get(configConstants.ENVIRONMENT);
    console.log(database);
    return this.appService.getHello();
  }
}
