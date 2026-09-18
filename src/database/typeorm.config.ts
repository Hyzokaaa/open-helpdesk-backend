import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'open_helpdesk',
  entities: [__dirname + '/../**/infrastructure/typeorm/models/*.model{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  // Mirrors app.module.ts: migrations that build indexes CONCURRENTLY opt out
  // of the transaction, and the default 'all' mode rejects that override.
  migrationsTransactionMode: 'each',
  synchronize: false,
  logging: false,
});

export default AppDataSource;
