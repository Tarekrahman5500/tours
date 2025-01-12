// Create DTO classes
import { createZodDto } from 'nestjs-zod';
import {
  CreateUserSchema,
  GetUserSchema,
  UpdateUserSchema,
} from '../schema/user.schema';

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
export class GetUserDto extends createZodDto(GetUserSchema) {}
export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
