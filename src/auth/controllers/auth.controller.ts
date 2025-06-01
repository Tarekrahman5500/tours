import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { LoginDto, SerializedUserDto } from '../../user/dto';
import { AuthService } from '../services';
import { Request } from 'express';
import { LocalGuard } from '../guard/local.guard';
import { ZodSerializerDto } from 'nestjs-zod';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @ZodSerializerDto(SerializedUserDto)
  @UseGuards(LocalGuard)
  @Post('login')
  async login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return request.session.passport.user;
  }
}
