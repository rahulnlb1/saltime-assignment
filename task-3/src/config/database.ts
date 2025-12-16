import knex from 'knex';
import config from '../../knexfile';

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment as keyof typeof config];

export const db = knex(dbConfig);

export const setTenantContext = async (tenantId: string): Promise<void> => {
  await db.raw('SELECT set_config(?, ?, true)', ['app.current_tenant', tenantId]);
};

export const clearTenantContext = async (): Promise<void> => {
  await db.raw('SELECT set_config(?, ?, true)', ['app.current_tenant', '', true]);
};

export default db;