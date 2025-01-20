import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from '../services';
import { CreateUserDto, UpdateUserDto } from '../dto';
import { ZodSerializerDto } from 'nestjs-zod';
import { Request } from 'express';
import { LoggedInGuard } from '../../auth/guard/logged-in.guard';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return await this.userService.createUser(createUserDto);
  }

  @UseGuards(LoggedInGuard)
  @ZodSerializerDto(UpdateUserDto)
  @Get(':id')
  async getUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ) {
    console.log(request.session);
    return await this.userService.getUserById(id);
  }
}
