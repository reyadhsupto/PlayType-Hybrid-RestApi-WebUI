// src/utils/dbClient.ts
import fs from "fs";
import { Client } from 'pg';
import mysql from 'mysql2/promise';
import { Socket } from 'net';
import config from './config.js';
import {logger} from "./logger.js";

export class DatabaseService {
  private static pgClient: Client | null = null;
  private static mysqlClient: any = null;
  private static sshClient: any = null;
  private static tunnelServer: any = null;

  /**
   * Connect to database via SSH tunnel using config
   /**
   * Connect to PostgreSQL or MySQL using ssh tunnel(bastion)
   * @param type 'postgres' | 'mysql'
   */
  static async connectWithSSH(type: 'postgres' | 'mysql'): Promise<void|null> {
    if (!config.db.enabled) {
      console.log('Database Query is disabled in config');
      logger.warn("Database Query is disabled in config");
      return null;
    }

    const { Client: SSHClient } = await import('ssh2');
    const net = await import('net');
    
    return new Promise((resolve, reject) => {
      this.sshClient = new SSHClient();

      this.sshClient.on('ready', () => {
        logger.info('SSH connection established');

        // Create TCP server for the tunnel
        this.tunnelServer = net.createServer((localSocket: Socket) => {
          this.sshClient.forwardOut(
            '127.0.0.1',
            0,
            type === 'postgres' ? config.db.pgsql.host : config.db.mysql.host,
            type === 'postgres' ? config.db.pgsql.port : config.db.mysql.port,
            (err: any, remoteStream: any) => {
              if (err) {
                localSocket.destroy();
                return;
              }
              // Pipe data between local socket and remote stream
              localSocket.pipe(remoteStream).pipe(localSocket);
            }
          );
        });

        // Start the tunnel server
        this.tunnelServer.listen(0, '127.0.0.1', async () => {
          const address = this.tunnelServer.address();
          const localPort = typeof address === 'object' && address ? address.port : 5435;
          logger.info(`SSH tunnel established on localhost:${localPort}`);

          try {
            // Connect to database through the local tunnel port
            if (type === 'postgres'){
                this.pgClient = new Client({
                host: '127.0.0.1',
                port: localPort,
                user: config.db.pgsql.user,
                password: config.db.pgsql.password,
                database: config.db.pgsql.name,
                connectionTimeoutMillis: 15000,
              });

              await this.pgClient.connect();
              logger.info('PostgreSql Database connected via SSH tunnel');
              resolve();
            } else if (type === 'mysql'){
                this.mysqlClient = await mysql.createConnection({
                host: '127.0.0.1',
                port: localPort,
                user: config.db.mysql.user,
                password: config.db.mysql.password,
                database: config.db.mysql.name,
                connectTimeout: 15000,
              });
              logger.info('MySQL Database connected via SSH tunnel');
              resolve();
            }
            
          } catch (error: any) {
            reject(new Error(`Database connection failed: ${error.message}`));
            throw new Error(`Database connection failed: ${error.message}`);
          }
        });

        this.tunnelServer.on('error', (err: any) => {
          reject(new Error(`Tunnel server error: ${err.message}`));

        });
      });

      this.sshClient.on('error', (err: any) => {
        reject(new Error(`SSH connection failed: ${err.message}`));
      });

      // SSH connection config
      const sshConfig: any = {
        host: config.db.ssh.host,
        port: config.db.ssh.port,
        username: config.db.ssh.username,
        readyTimeout: 20000,
      };

      if (config.db.ssh.privateKeyPath) {
        sshConfig.privateKey = fs.readFileSync(config.db.ssh.privateKeyPath);
      }

      logger.info(`Connecting to SSH server ${sshConfig.host}:${sshConfig.port}...`);
      this.sshClient.connect(sshConfig);
    });
  }

  /**
   * Connect to database directly using config
    /**
   * Connect to PostgreSQL or MySQL directly
   * @param type 'postgres' | 'mysql'
   */
  static async connectDirect(type: 'postgres' | 'mysql'): Promise<void> {
    if (!config.db.enabled) {
      throw new Error('Database is disabled in config');
    }

    try {
      // Connect to database through the local tunnel port
      if (type === 'postgres'){
          this.pgClient = new Client({
            host: config.db.pgsql.host,
            port: config.db.pgsql.port,
            user: config.db.pgsql.user,
            password: config.db.pgsql.password,
            database: config.db.pgsql.name,
            connectionTimeoutMillis: 15000,
        });

        await this.pgClient.connect();
        logger.info('Postgres Database connected directly');
        
      } else if (type === 'mysql'){
          this.mysqlClient = await mysql.createConnection({
          host: config.db.mysql.host,
          port: config.db.mysql.port,
          user: config.db.mysql.user,
          password: config.db.mysql.password,
          database: config.db.mysql.name,
          connectTimeout: 15000
        });
      logger.info('MySQL Database connected directly');
      }
      
    } catch (error: any) {
        throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Execute query - automatically handles connection and cleanup
  /**
   * Execute query for PostgreSQL or MySQL
   * @param type 'postgres' | 'mysql'
   */
  static async query<T = any>(type: 'postgres' | 'mysql', sql: string, params: any[] = []): Promise<T[]> {
    // If DB is disabled, log and return empty array
    if (!config.db.enabled) {
      logger.warn('Database is disabled in config, query skipped.');
      return [];
    }

    // Connect based on config
    if (config.db.ssh.useSsh) {
      await this.connectWithSSH(type);
    } else {
      await this.connectDirect(type);
    }

    try {
      // Execute query and store result
      let queryResult: T[];

      if (type === 'postgres') {
        const result = await this.pgClient!.query(sql, params);
        queryResult = result.rows as T[];
      } else {
        const [rows] = await this.mysqlClient!.execute(sql, params);
        queryResult = rows as T[];
      }

      // Safe debug logging
      logger.debug(`[${type}] SQL: ${sql}`);
      logger.debug(`[${type}] Params: ${JSON.stringify(params)}`);
      logger.debug(`[${type}] Rows returned: ${queryResult.length}`);
      if (queryResult.length <= 100) {
        logger.debug(`[${type}] Query result: ${JSON.stringify(queryResult, null, 2)}`);
      } else {
        logger.debug(`[${type}] Result too large to log (${queryResult.length} rows), skipping full output`);
      }

      return queryResult;
    } catch (error: any) {
      logger.error(`[${type}] Query execution failed: ${error.message}`);
      logger.error(`[${type}] SQL: ${sql}`);
      logger.error(`[${type}] Params: ${JSON.stringify(params)}`);
      throw error;
    } finally {
      // Always close connection after query
      await this.closeDB();
    }
  }

  /**
   * Close database(Postgres/Mysql) connection
   * Closes SSh tunnel
   */
  static async closeDB(): Promise<void> {
    if (this.pgClient) {
      await this.pgClient.end();
      this.pgClient = null;
      logger.info('Database connection closed');
    }

    if (this.mysqlClient) {
      await this.mysqlClient.end();
      this.mysqlClient = null;
      logger.info('MySQL connection closed');
    }

    if (this.tunnelServer) {
      this.tunnelServer.close();
      this.tunnelServer = null;
      logger.info('SSH tunnel closed');
    }

    if (this.sshClient) {
      this.sshClient.end();
      this.sshClient = null;
      logger.info('SSH connection closed');
    }
  }
}