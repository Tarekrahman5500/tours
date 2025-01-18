// src/guards/local.guard.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalGuard extends AuthGuard('local') {
  handleRequest(err, user, info) {
    if (err) {
      console.error(err); // Log any errors
      throw err;
    }
    if (!user) {
      console.error(info); // Log info to understand why authentication failed
      throw new UnauthorizedException();
    }
    return user;
  }
}
