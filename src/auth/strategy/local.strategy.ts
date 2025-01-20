import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../services';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email', // Specify the field name for username (email in this case)
    });
  }

  async validate(email: string, password: string): Promise<any> {
    // Validate the user using AuthService
    const user = await this.authService.validateUser(email, password);

    // Log the user object to debug
    //console.log('User returned from validateUser:', user);

    if (!user) {
      console.error('Invalid user credentials'); // Log error for invalid credentials
      throw new UnauthorizedException('Invalid email or password');
    }

    return user; // Passport will attach this to req.user
  }
}
