import { z, parseEnv } from 'znv';
import * as dotenv from 'dotenv';
dotenv.config({
  path: '.env',
});

//console.log(process.env);
// Load environment variables from.env fileDefine Zod schema for environment variables
export const environmentSchema = {
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('5000'),
  DATABASE_USERNAME: z.string().nonempty(),
  DATABASE_PASSWORD: z.string().nonempty(),
  DATABASE_NAME: z.string().nonempty(),
  DATABASE_HOST: z.string().nonempty(),
  DATABASE_PORT: z.string().regex(/^\d+$/).transform(Number).default('5432'),
  DATABASE_DIALECT: z
    .enum(['postgres', 'mysql', 'sqlite', 'mssql'])
    .default('postgres'),
};

// Parse and validate environment variables
export const envVariables = parseEnv(process.env, environmentSchema);
