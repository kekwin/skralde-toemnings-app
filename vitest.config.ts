import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["shared/**/*.test.ts", "backend/**/*.test.ts", "src/**/*.test.ts"],
  },
});
