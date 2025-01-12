import { registerAs } from '@nestjs/config';
import { envVariables } from './env.schema';
import { configConstants } from './config.constants';

// Register the environment variables
export const envConfiguration = registerAs(
  configConstants.ENVIRONMENT,
  () => envVariables,
);

/*const config: DataSourceOptions = {
  type: envVariables.DATABASE_DIALECT,
  host: envVariables.DATABASE_HOST,
  port: envVariables.DATABASE_PORT,
  username: envVariables.DATABASE_USERNAME,
  password: envVariables.DATABASE_PASSWORD,
  database: envVariables.DATABASE_NAME,
  synchronize: false,
  logging: false, // Enable logging for debugging purposes

  // Use different paths for entities and migrations based on the environment
  entities: [__dirname + '/../!**!/!*.entity.{js,ts}'],
  migrations: [join(__dirname, '/../migrations/!*.{js,ts}')],
};*/

/*export const databaseConfiguration = registerAs(
  configConstants.DATABASE,
  () => dataSourceConfig,
);*/
