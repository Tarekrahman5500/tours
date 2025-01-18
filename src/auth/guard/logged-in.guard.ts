// src/guards/logged-in.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class LoggedInGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return request.isAuthenticated(); // Returns true if the user is logged in
  }
}
