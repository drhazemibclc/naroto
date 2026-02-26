import chalk from 'chalk';
import dayjs from 'dayjs';

import type { LogEntry, Transport } from '../types';

const levelColors: Record<string, typeof chalk> = {
  fatal: chalk.red.bold,
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.blue,
  debug: chalk.cyan,
  trace: chalk.gray,
  audit: chalk.magenta.bold
};

const typeColors: Record<string, typeof chalk> = {
  PATIENT_REGISTRATION: chalk.bgBlue.white,
  APPOINTMENT: chalk.bgGreen.white,
  ENCOUNTER: chalk.bgMagenta.white,
  VITALS: chalk.bgCyan.white,
  GROWTH_CHART: chalk.bgYellow.black,
  IMMUNIZATION: chalk.bgYellow.white,
  PRESCRIPTION: chalk.bgRed.white,
  SECURITY: chalk.bgRed.white.bold,
  AI_NUTRITION: chalk.bgGreen.white,
  QUEUE_UPDATE: chalk.bgBlue.white,
  AUDIT: chalk.bgMagenta.white.bold,
  SYSTEM: chalk.bgGray.white
};

export class ConsoleTransport implements Transport {
  name = 'console';
  async log(entry: LogEntry): Promise<void> {
    const timestamp = dayjs(entry.timestamp).format('HH:mm:ss.SSS');
    const levelColor = levelColors[entry.level] || chalk.white;
    const typeColor = entry.metadata?.type ? typeColors[entry.metadata.type] || chalk.white : chalk.white;

    // Build the log line
    const parts: string[] = [chalk.gray(`[${timestamp}]`), levelColor(entry.level.toUpperCase().padEnd(7))];

    if (entry.metadata?.type) {
      parts.push(typeColor(` ${entry.metadata.type} `));
    }

    if (entry.metadata?.requestId) {
      parts.push(chalk.gray(`[${entry.metadata.requestId.slice(0, 8)}]`));
    }

    parts.push(entry.message);

    // Add metadata if present
    const metadata = { ...entry.metadata };
    metadata.type = undefined;
    metadata.requestId = undefined;

    if (Object.keys(metadata).length > 0) {
      parts.push(`\n${chalk.gray(JSON.stringify(metadata, null, 2))}`);
    }

    // Add error if present
    if (entry.error) {
      parts.push(`\n${chalk.red(entry.error.stack || entry.error.message)}`);
    }

    // Add audit details if present
    if (entry.metadata?.audit) {
      parts.push(`\n${chalk.magenta(JSON.stringify(entry.metadata.audit, null, 2))}`);
    }

    // Output to appropriate console method
    const output = parts.join(' ');

    switch (entry.level) {
      case 'fatal':
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'info':
        console.info(output);
        break;
      default:
        console.log(output);
    }
  }
}
export default ConsoleTransport;
