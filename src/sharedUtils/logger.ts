// src/utils/logger.ts

/**
 * Logger file to write logs inside master.log and test-run-**.log files
 * Usage:
 *       Throughout the whole framework
 */

import { createLogger, format, transports } from 'winston';
import * as fs from 'fs';
import * as path from 'path';

const { combine, timestamp, printf, colorize } = format;

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}


const runIdFile = path.join(logsDir, '.run-id.json');
export const time_now = new Date()
export const local_time = time_now.toLocaleString().replace(/[\/,: ]/g, '-');

// Ensure run-id.json exists
if (!fs.existsSync(runIdFile)) {
  fs.writeFileSync(runIdFile, JSON.stringify({ runId: local_time }, null, 2), 'utf-8');
}

const { runId } = JSON.parse(fs.readFileSync(runIdFile, 'utf-8'));

export const runLogFile = path.join(logsDir, `test-run-${runId}.log`);
export const masterLogFile = path.join(logsDir, 'master.log');

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}] : ${message}`;
});

export const logger = createLogger({
  level: 'debug',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
  transports: [
    new transports.Console({
      level: 'info',
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),
    new transports.File({ filename: runLogFile, level: 'debug' }),
    new transports.File({ filename: masterLogFile, level: 'debug', options: { flags: 'a' } }),
  ],
});





