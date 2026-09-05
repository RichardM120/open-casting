import { createServer } from "node:http";
import { appendFileSync } from "node:fs";
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try { appendFileSync("/tmp/audit-mail.log", JSON.parse(body).text + "\n"); } catch {}
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "audit" }));
  });
}).listen(3399, "127.0.0.1", () => console.log("sink on 3399"));
