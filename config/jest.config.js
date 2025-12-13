const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env.local files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  rootDir: '../',
  setupFilesAfterEnv: ['<rootDir>/config/jest.setup.js'],
  testEnvironment: 'jest-environment-node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
    '**/*.test.[jt]s?(x)',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
    '/out/',
  ],
  collectCoverageFrom: [
    'lib/**/*.{js,ts,tsx}',
    'components/**/*.{js,ts,tsx}',
    'app/**/*.{js,ts,tsx}',
    'src/application/**/*.{js,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/__mocks__/**',
    '!**/*.test.{js,ts,tsx}',
    '!**/*.spec.{js,ts,tsx}',
  ],
  testTimeout: 30000, // 30 seconds for integration tests
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)

