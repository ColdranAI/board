import { test as base } from "@playwright/test";
import { db } from "@/lib/db";

type TestFixtures = {
  db: typeof db;
};

export const test = base.extend<TestFixtures>({
  db: async ({}, use) => {
    await use(db);
    // Cleanup if needed
  },
});

export { expect } from "@playwright/test";
