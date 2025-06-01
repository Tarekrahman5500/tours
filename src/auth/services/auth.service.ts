import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../../user';
import * as argon2 from 'argon2';
import { User } from '../../user/entities';

@Injectable()
export class AuthService {
  constructor(private readonly userService: UserService) {}

  async validateUser(email: string, password: string): Promise<Partial<User>> {
    // Replace this with your user validation logic (e.g., check database)
    const user = await this.userService.getUserByEmail(email);
    //console.log(user);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(user.password, password);

    //console.log(isPasswordValid);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }
}
