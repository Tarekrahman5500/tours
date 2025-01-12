import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { UserService } from '../services';
import { CreateUserDto, UpdateUserDto } from '../dto';
import { ZodSerializerDto } from 'nestjs-zod';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return await this.userService.createUser(createUserDto);
  }

  @ZodSerializerDto(UpdateUserDto)
  @Get(':id')
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    return await this.userService.getUserById(id);
  }
}
