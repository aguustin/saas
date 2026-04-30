import type { Config } from 'jest'

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir:              'src',
  testRegex:            '(?<!integration)\\.spec\\.ts$',
  transform:            { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom:  ['**/*.(t|j)s', '!**/__tests__/**', '!**/index.ts'],
  coverageDirectory:    '../coverage',
  testEnvironment:      'node',
  moduleNameMapper: {
    '^@common/(.*)$':   '<rootDir>/common/$1',
    '^@config/(.*)$':   '<rootDir>/config/$1',
    '^@modules/(.*)$':  '<rootDir>/modules/$1',
    '^@database/(.*)$': '<rootDir>/database/$1',
  },
}

export default config
