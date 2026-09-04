import { defineConfig } from "prisma/config";

const schema = process.env.REHEARSAL_SCHEMA_PATH;
const migrationsPath = process.env.REHEARSAL_MIGRATIONS_PATH;
const url = process.env.DIRECT_URL;

if (!schema || !migrationsPath || !url) {
  throw new Error("temporary rehearsal config requires schema, migrations path and DIRECT_URL");
}

export default defineConfig({
  schema,
  migrations: { path: migrationsPath },
  datasource: { url },
});
