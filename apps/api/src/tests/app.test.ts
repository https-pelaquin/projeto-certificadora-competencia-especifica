import request from "supertest";
import { expect, it } from "vitest";
import { createApp } from "../app";

const app = createApp();

it("GET /api/health responde ok com o banco acessível", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(res.headers["x-request-id"]).toBeTruthy();
});

it("rota inexistente responde 404 no formato padrão", async () => {
    const res = await request(app).get("/api/nao-existe");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
});

it("recusa corpo que não seja JSON (CSRF)", async () => {
    const res = await request(app).post("/api/health").type("form").send("a=1");
    expect(res.status).toBe(415);
});

it("JSON malformado responde 400", async () => {
    const res = await request(app).post("/api/health").set("Content-Type", "application/json").send("{x");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
});
