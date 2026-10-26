import { execSync } from "node:child_process";
import pg from "pg";

// Recria o banco de teste do zero e aplica as migrations antes da suíte.
export default async function setup() {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    const database = url.pathname.slice(1);

    const admin = new pg.Client({ connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).toString() });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${database}"`);
    await admin.end();

    execSync("pnpm exec prisma migrate deploy", {
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: "ignore",
    });
}
