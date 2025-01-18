// Create DTO classes
import { createZodDto } from 'nestjs-zod';
import {
  CreateUserSchema,
  GetUserSchema,
  LoginSchema,
  SerializedUserSchema,
  UpdateUserSchema,
} from '../schema';

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
export class GetUserDto extends createZodDto(GetUserSchema) {}
export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
export class LoginDto extends createZodDto(LoginSchema) {}
export class SerializedUserDto extends createZodDto(SerializedUserSchema) {}
