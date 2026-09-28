module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.js'],
  // Fail `npm run coverage` if coverage ever drops below the assignment's 80% target.
  coverageThreshold: { global: { statements: 80, branches: 80, functions: 80, lines: 80 } },
  testMatch: ['**/tests/**/*.test.js'],
};
