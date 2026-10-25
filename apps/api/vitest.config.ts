import "dotenv/config";
import { defineConfig } from "vitest/config";

if (!process.env.TEST_DATABASE_URL) {
    throw new Error("Defina TEST_DATABASE_URL no .env para rodar os testes");
}

export default defineConfig({
    test: {
        include: ["src/**/*.test.ts"],
        globalSetup: ["src/test/global-setup.ts"],
        fileParallelism: false,
        env: {
            NODE_ENV: "test",
            DATABASE_URL: process.env.TEST_DATABASE_URL,
            BCRYPT_ROUNDS: "4",
        },
    },
});
