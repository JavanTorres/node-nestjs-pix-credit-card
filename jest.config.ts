import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Config } from '@jest/types';
import { pathsToModuleNameMapper } from 'ts-jest';

const { compilerOptions } = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tsconfig.json'), 'utf8'),
) as { compilerOptions: { paths: Record<string, string[]> } };

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],

  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.test.ts'],

  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },

  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/src/',
  }),

  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],

  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  coverageDirectory: '<rootDir>/coverage',
};

export default config;
