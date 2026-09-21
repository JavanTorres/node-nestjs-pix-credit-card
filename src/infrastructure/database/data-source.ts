import 'reflect-metadata';

import { existsSync } from 'node:fs';

import { DataSource } from 'typeorm';

import { loadConfiguration } from '@config/configuration';

import { buildTypeOrmOptions } from './typeorm.options';

if (existsSync('.env')) process.loadEnvFile('.env');

export default new DataSource(
  buildTypeOrmOptions(loadConfiguration().database),
);
