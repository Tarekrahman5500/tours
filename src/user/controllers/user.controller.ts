import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { UserService } from '../services';
import { CreateUserDto, UpdateUserDto } from '../dto';
import { ZodSerializerDto } from 'nestjs-zod';
import { Request } from 'express';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return await this.userService.createUser(createUserDto);
  }

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
