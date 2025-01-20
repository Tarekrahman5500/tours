import { PassportSerializer } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  serializeUser(user: any, done: (err: Error, user: any) => void): void {
    console.log('Serializing user:', user);
    done(null, user);
  }

  deserializeUser(
    payload: any,
    done: (err: Error, payload: any) => void,
  ): void {
    console.log('Deserializing user:', payload);
    done(null, payload);
  }
}
