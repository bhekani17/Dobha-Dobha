// Database adapter that mimics Cloudflare D1 interface using PostgreSQL
// This allows existing SQL queries to work with minimal changes

const { Client } = require('pg');

class PreparedStatement {
  constructor(client, sql, params = []) {
    this.client = client;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new PreparedStatement(this.client, this.sql, params);
  }

  async all() {
    try {
      const result = await this.client.query(this.sql, this.params);
      return { results: result.rows };
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  async first() {
    try {
      const result = await this.client.query(this.sql, this.params);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }

  async run() {
    try {
      const result = await this.client.query(this.sql, this.params);
      return { meta: { changes: result.rowCount } };
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  }
}

class Database {
  constructor(config) {
    this.config = config;
    this.client = null;
  }

  async connect() {
    if (!this.client) {
      this.client = new Client({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl || false,
      });
      await this.client.connect();
    }
    return this.client;
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  prepare(sql) {
    return new PreparedStatement(this.client || this, sql);
  }

  async batch(statements) {
    const client = await this.connect();
    try {
      await client.query('BEGIN');
      const results = [];
      for (const stmt of statements) {
        const result = await client.query(stmt.sql, stmt.params);
        results.push(result);
      }
      await client.query('COMMIT');
      return { results };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
}

// Factory function to create database adapter based on environment
export function createDatabase(env) {
  // If AWS RDS configuration is present, use PostgreSQL
  if (env.DB_HOST && env.DB_USER && env.DB_PASSWORD) {
    return new Database({
      host: env.DB_HOST,
      port: env.DB_PORT || 5432,
      database: env.DB_NAME || 'dobha',
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      ssl: true, // RDS requires SSL
    });
  }

  // Otherwise, use Cloudflare D1 (original env.DB)
  return env.DB;
}

// Helper to handle connection lifecycle in Lambda
export async function withDatabase(db, callback) {
  if (db instanceof Database) {
    await db.connect();
    try {
      return await callback(db);
    } finally {
      await db.disconnect();
    }
  } else {
    // Cloudflare D1 doesn't need connect/disconnect
    return await callback(db);
  }
}
