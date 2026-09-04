import http from "node:http";
import https from "node:https";

const secure = Boolean(process.env.PRINT_GATEWAY_TLS_CERT_PATH);
const client = secure ? https : http;
const request = client.request({
  host: "127.0.0.1",
  port: Number(process.env.PRINT_GATEWAY_PORT),
  path: "/health",
  method: "GET",
  rejectUnauthorized: false,
  headers: { origin: process.env.PRINT_GATEWAY_ALLOWED_ORIGINS?.split(",")[0] },
}, (response) => process.exit(response.statusCode === 200 ? 0 : 1));
request.setTimeout(3000, () => request.destroy(new Error("health timeout")));
request.once("error", () => process.exit(1));
request.end();
