/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
// eslint-disable-next-line no-undef
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["json", "html"],
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.jest.json",
    },
  },
  testMatch: [
    "<rootDir>/packages/*/src/**/*.test.ts",
    "<rootDir>/packages/*/test/**/*.test.ts",
  ],
  modulePathIgnorePatterns: ["<rootDir>/packages/core-browser-test"],
};
