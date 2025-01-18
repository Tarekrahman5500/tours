import { z } from 'zod';
import { statusEnumValues } from '../constants';
export const CreateUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(255),
  lastName: z.string().min(1, 'Last name is required').max(255),
  email: z.string().email('Invalid email format'),
  phone: z.string().min(10).max(15),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  profilePicture: z.string().url().optional(),
  type: z.enum(statusEnumValues).optional(),
});

export const GetUserSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

// New schema extending CreateUserSchema and omitting 'password'
export const UpdateUserSchema = CreateUserSchema.omit({ password: true });

// Extend CreateUserSchema for UserSchema
export const UserSchema = CreateUserSchema.extend({
  id: z.string().uuid('Invalid UUID format'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Serialized User schema (excluding password and sensitive fields)
export const SerializedUserSchema = UserSchema.omit({ password: true });
