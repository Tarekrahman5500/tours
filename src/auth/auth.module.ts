import { Module } from '@nestjs/common';
import { AuthService } from './services';

import { LocalStrategy, SessionSerializer } from './strategy';
import { AuthController } from './controllers';
import { UserModule } from '../user';

@Module({
  imports: [UserModule],
  providers: [AuthService, LocalStrategy, SessionSerializer],
  exports: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
