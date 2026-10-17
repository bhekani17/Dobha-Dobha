import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const handler = async (event) => {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;

  const client = new pg.Client({
    host: DB_HOST,
    port: parseInt(DB_PORT),
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
  });

  try {
    await client.connect();
    console.log('Connected to RDS database');

    // Read all migration files
    const migrationsDir = join(__dirname, '../migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      const sql = await fs.readFile(join(migrationsDir, file), 'utf-8');

      try {
        await client.query(sql);
        console.log(`✓ Migration ${file} completed`);
      } catch (error) {
        // Ignore errors for ALTER TABLE ADD COLUMN if column already exists
        if (error.code === '42701') {
          console.log(`✓ Migration ${file} skipped (column already exists)`);
        } else {
          console.error(`✗ Migration ${file} failed:`, error.message);
          throw error;
        }
      }
    }

    console.log('All migrations completed successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Migrations completed successfully' }),
    };
  } catch (error) {
    console.error('Migration failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    await client.end();
  }
};
