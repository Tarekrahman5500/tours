import { z } from 'zod';

// Login schema
export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'), // Validate email format
  password: z.string().min(6, 'Password must be at least 6 characters long'), // Validate password length
});
