require("dotenv").config({ quiet: true });
const app = require("../src/app");

const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS: ${message}`); };

const run = async () => {
    const server = app.listen(0, "127.0.0.1");
    try {
        await new Promise((resolve) => server.once("listening", resolve));
        const base = `http://127.0.0.1:${server.address().port}`;
        const health = await fetch(`${base}/`);
        assert(health.status === 200, "health endpoint responds");
        assert(health.headers.get("x-content-type-options") === "nosniff", "Helmet nosniff header is set");
        assert(Boolean(health.headers.get("x-frame-options")), "Helmet frame protection header is set");
        const missing = await fetch(`${base}/api/not-a-route`);
        assert(missing.status === 404 && (await missing.json()).message === "API route not found", "safe API 404 response is returned");
        let lastStatus = 0;
        for (let index = 0; index < 11; index += 1) {
            const response = await fetch(`${base}/api/auth/management/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
            lastStatus = response.status;
        }
        assert(lastStatus === 429, "management login limiter returns 429 after its safe threshold");
    } finally { await new Promise((resolve) => server.close(resolve)); }
};
run().catch((error) => { console.error(`FAIL: ${error.message}`); process.exitCode = 1; });
