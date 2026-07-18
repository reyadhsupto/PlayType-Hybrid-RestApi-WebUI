// src/sharedUtils/dbClient.ts

import fs from "fs";
import net, { type Server } from "net";
import { Pool as PgPool } from "pg";
import { createPool, type Pool as MySqlPool } from "mysql2/promise";
import config, { type DatabaseConnectionConfig, type NamedDatabaseConfig } from "./config.js";
import { logger } from "./logger.js";

type DatabasePool = PgPool | MySqlPool;

/**
 * DatabaseService manages named PostgreSQL and MySQL pools for a worker.
 *
 * Each database key gets its own pool, SSH tunnel, and cleanup path.
 */
export class DatabaseService {
  private readonly runtimeConfig: typeof config;
  private readonly databaseConfigs: Record<string, NamedDatabaseConfig>;
  private readonly pools = new Map<string, DatabasePool>();
  private readonly sshClients = new Map<string, any>();
  private readonly tunnelServers = new Map<string, Server>();
  private readonly initPromises = new Map<string, Promise<void>>();

  /**
   * Create a database service instance bound to a resolved framework config.
   *
   * @param runtimeConfig - Framework config for the current worker
   * @returns A database service ready to initialize pools lazily or eagerly
   */
  constructor(runtimeConfig = config) {
    this.runtimeConfig = runtimeConfig;
    this.databaseConfigs = runtimeConfig.db.connections;
  }

  /**
   * Initialize all configured database pools for the worker.
   *
   * @returns A promise that resolves when every configured pool is ready
   */
  async init(): Promise<void> {
    if (!this.runtimeConfig.db.enabled) {
      logger.warn("Database query is disabled in config");
      return;
    }

    await Promise.all(this.getDatabaseKeys().map((databaseKey) => this.ensurePool(databaseKey)));
  }

  /**
   * Execute a SQL query using the pool mapped to the given database key.
   *
   * @typeParam T - Expected row type returned by the query
   * @param databaseKey - Named database key from config.db.connections
   * @param sql - SQL statement to execute
   * @param params - Query parameter values
   * @returns A promise that resolves to an array of rows
   */
  async query<T = any>(databaseKey: string, sql: string, params: any[] = []): Promise<T[]> {
    if (!this.runtimeConfig.db.enabled) {
      logger.warn("Database is disabled in config, query skipped.");
      return [];
    }

    await this.ensurePool(databaseKey);

    const databaseConfig = this.getDatabaseConfig(databaseKey);
    if (!databaseConfig) {
      throw new Error(`Database "${databaseKey}" is not configured`);
    }

    try {
      const rows = await this.executeQuery<T>(databaseKey, databaseConfig.type, sql, params);

      logger.debug(`[${databaseKey}] SQL: ${sql}`);
      logger.debug(`[${databaseKey}] Params: ${JSON.stringify(params)}`);
      logger.debug(`[${databaseKey}] Rows returned: ${rows.length}`);

      if (rows.length <= 100) {
        logger.debug(`[${databaseKey}] Query result: ${JSON.stringify(rows, null, 2)}`);
      } else {
        logger.debug(`[${databaseKey}] Result too large to log (${rows.length} rows), skipping full output`);
      }

      return rows;
    } catch (error: any) {
      logger.error(`[${databaseKey}] Query execution failed: ${error.message}`);
      logger.error(`[${databaseKey}] SQL: ${sql}`);
      logger.error(`[${databaseKey}] Params: ${JSON.stringify(params)}`);
      throw error;
    }
  }

  /**
   * Close every configured database pool and SSH tunnel.
   *
   * @returns A promise that resolves when cleanup finishes
   */
  async closeAll(): Promise<void> {
    for (const databaseKey of this.getDatabaseKeys()) {
      try {
        await this.closeDatabase(databaseKey);
      } catch (error: any) {
        logger.warn(`Failed to close database "${databaseKey}" cleanly: ${error.message}`);
      }
    }
  }

  /**
   * Ensure a pool exists for a specific database key.
   *
   * @param databaseKey - Named database key from config
   * @returns A promise that resolves once the pool is ready
   */
  private async ensurePool(databaseKey: string): Promise<void> {
    if (this.pools.has(databaseKey)) {
      return;
    }

    const existingInit = this.initPromises.get(databaseKey);
    if (existingInit) {
      await existingInit;
      return;
    }

    const initPromise = this.createPool(databaseKey);
    this.initPromises.set(databaseKey, initPromise);

    try {
      await initPromise;
    } finally {
      this.initPromises.delete(databaseKey);
    }
  }

  /**
   * Create and validate a pool for a database key.
   *
   * @param databaseKey - Named database key from config
   * @returns A promise that resolves after the pool is healthy
   */
  private async createPool(databaseKey: string): Promise<void> {
    const databaseConfig = this.getDatabaseConfig(databaseKey);
    if (!databaseConfig) {
      throw new Error(`Database "${databaseKey}" is not configured`);
    }

    const connectionTarget = databaseConfig.useSsh
      ? await this.createSshTunnel(databaseKey, databaseConfig.connection, databaseConfig.ssh!)
      : databaseConfig.connection;

    if (databaseConfig.type === "postgres") {
      const pool = new PgPool({
        host: connectionTarget.host,
        port: connectionTarget.port,
        user: connectionTarget.user,
        password: connectionTarget.password,
        database: connectionTarget.name,
        max: databaseConfig.poolMax ?? this.runtimeConfig.db.defaultPoolMax,
        connectionTimeoutMillis: 15000,
      });

      this.pools.set(databaseKey, pool);
      await pool.query("SELECT 1");
      logger.info(`${databaseKey} PostgreSQL pool initialized`);
      return;
    }

    const pool = createPool({
      host: connectionTarget.host,
      port: connectionTarget.port,
      user: connectionTarget.user,
      password: connectionTarget.password,
      database: connectionTarget.name,
      waitForConnections: true,
      connectionLimit: databaseConfig.poolMax ?? this.runtimeConfig.db.defaultPoolMax,
      connectTimeout: 15000,
    });

    this.pools.set(databaseKey, pool);
    await pool.query("SELECT 1");
    logger.info(`${databaseKey} MySQL pool initialized`);
  }

  /**
   * Execute a SQL query using a resolved database type.
   *
   * @typeParam T - Expected row type returned by the query
   * @param databaseKey - Named database key from config
   * @param type - Database engine type
   * @param sql - SQL statement to execute
   * @param params - Query parameters
   * @returns A promise that resolves to rows
   */
  private async executeQuery<T = any>(
    databaseKey: string,
    type: NamedDatabaseConfig["type"],
    sql: string,
    params: any[]
  ): Promise<T[]> {
    const pool = this.pools.get(databaseKey);
    if (!pool) {
      throw new Error(`Database pool for "${databaseKey}" is not initialized`);
    }

    if (type === "postgres") {
      const result = await (pool as PgPool).query(sql, params);
      return result.rows as T[];
    }

    const [rows] = await (pool as MySqlPool).query(sql, params);
    return rows as T[];
  }

  /**
   * Create an SSH tunnel and return the local connection target.
   *
   * @param databaseKey - Named database key from config
   * @param connection - Remote database connection definition
   * @param ssh - SSH connection definition used for tunneling
   * @returns A promise that resolves to a local connection target
   */
  private async createSshTunnel(
    databaseKey: string,
    connection: DatabaseConnectionConfig,
    ssh: NonNullable<NamedDatabaseConfig["ssh"]>
  ): Promise<DatabaseConnectionConfig> {
    const { Client: SSHClient } = await import("ssh2");
    const sshConfig = this.getSshConfig(ssh);

    return new Promise((resolve, reject) => {
      const sshClient = new SSHClient();
      this.sshClients.set(databaseKey, sshClient);

      sshClient.on("ready", () => {
        logger.info(`SSH connection established for ${databaseKey}`);

        const tunnelServer = net.createServer((localSocket) => {
          sshClient.forwardOut("127.0.0.1", 0, connection.host, connection.port, (err: any, remoteStream: any) => {
            if (err) {
              localSocket.destroy();
              reject(new Error(`SSH tunnel forwarding failed for ${databaseKey}: ${err.message}`));
              return;
            }

            localSocket.pipe(remoteStream).pipe(localSocket);
          });
        });

        this.tunnelServers.set(databaseKey, tunnelServer);

        tunnelServer.listen(0, "127.0.0.1", () => {
          const address = tunnelServer.address();
          const localPort = typeof address === "object" && address ? address.port : 5435;

          logger.info(`SSH tunnel established for ${databaseKey} on localhost:${localPort}`);
          resolve({
            host: "127.0.0.1",
            port: localPort,
            user: connection.user,
            password: connection.password,
            name: connection.name,
          });
        });

        tunnelServer.on("error", (err: any) => {
          reject(new Error(`Tunnel server error for ${databaseKey}: ${err.message}`));
        });
      });

      sshClient.on("error", (err: any) => {
        reject(new Error(`SSH connection failed for ${databaseKey}: ${err.message}`));
      });

      logger.info(`Connecting to SSH server ${sshConfig.host}:${sshConfig.port} for ${databaseKey}...`);
      sshClient.connect(sshConfig);
    });
  }

  /**
   * Build the SSH connection settings for a database key.
   *
   * @param ssh - SSH connection definition from config
   * @returns SSH client configuration
   */
  private getSshConfig(ssh: NonNullable<NamedDatabaseConfig["ssh"]>): any {
    const sshConfig: any = {
      host: ssh.host,
      port: ssh.port,
      username: ssh.username,
      readyTimeout: 20000,
    };

    if (ssh.privateKeyPath) {
      sshConfig.privateKey = fs.readFileSync(ssh.privateKeyPath);
    }

    if (ssh.password) {
      sshConfig.password = ssh.password;
    }

    return sshConfig;
  }

  /**
   * Resolve a named database configuration.
   *
   * @param databaseKey - Named database key from config
   * @returns The database config if it exists
   */
  private getDatabaseConfig(databaseKey: string): NamedDatabaseConfig | null {
    return this.databaseConfigs[databaseKey] ?? null;
  }

  /**
   * Return the list of configured database keys.
   *
   * @returns All configured database names
   */
  private getDatabaseKeys(): string[] {
    return Object.keys(this.databaseConfigs);
  }

  /**
   * Close a single database pool and its SSH resources.
   *
   * @param databaseKey - Named database key from config
   * @returns A promise that resolves once cleanup completes
   */
  private async closeDatabase(databaseKey: string): Promise<void> {
    const pool = this.pools.get(databaseKey);
    if (pool) {
      try {
        await pool.end();
        logger.info(`Database pool closed for ${databaseKey}`);
      } catch (error: any) {
        logger.warn(`Failed to close pool for ${databaseKey}: ${error.message}`);
      } finally {
        this.pools.delete(databaseKey);
      }
    }

    const tunnelServer = this.tunnelServers.get(databaseKey);
    if (tunnelServer) {
      try {
        await new Promise<void>((resolve) => {
          tunnelServer.close(() => resolve());
        });
        logger.info(`SSH tunnel closed for ${databaseKey}`);
      } catch (error: any) {
        logger.warn(`Failed to close SSH tunnel for ${databaseKey}: ${error.message}`);
      } finally {
        this.tunnelServers.delete(databaseKey);
      }
    }

    const sshClient = this.sshClients.get(databaseKey);
    if (sshClient) {
      try {
        sshClient.end();
        logger.info(`SSH connection closed for ${databaseKey}`);
      } catch (error: any) {
        logger.warn(`Failed to close SSH connection for ${databaseKey}: ${error.message}`);
      } finally {
        this.sshClients.delete(databaseKey);
      }
    }
  }
}
