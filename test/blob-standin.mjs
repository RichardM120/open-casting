import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { createSecureServer } from "node:http2";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * A stand-in for Vercel Blob, so the suites can put files up and read them
 * back without a store. The app and its SDK talk to it exactly as they talk
 * to the real store: the server asks it for a signed token, the browser puts
 * the file to it with that token's parameters, and the server reads the file
 * back, lists it and deletes it. Files live in memory for the run.
 *
 * The URLs it hands out are on a real-looking Vercel host, so every check in
 * the app that a file is the store's own passes unchanged. Nothing ever
 * fetches that host: the server reads through BLOB_READ_BASE, which the
 * harness points here. The browser's SDK puts files to vercel.com, and a
 * browser lets nothing intercept a file's bytes on the way, so the suite's
 * browser is given a proxy instead: a tunnel here for vercel.com and a
 * refusal for anything else. The browser then does exactly what it does on a
 * deployment, preflight and all, against a stand-in that answers on HTTPS
 * with a certificate it makes for itself as it starts. It speaks HTTP/2, as
 * the real endpoint does, because the SDK streams a file up with progress,
 * and a browser will only stream a request body over HTTP/2.
 */
export const STORE_ID = "standin000000000";
export const HOST = `${STORE_ID}.private.blob.vercel-storage.com`;
/** The read-write token the harness gives the server: the SDK reads the store id out of it. */
export const TOKEN = `vercel_blob_rw_${STORE_ID}_standinsecret`;

/** What the real store infers from a file's name when the upload names no type. */
const TYPES = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
  txt: "text/plain",
};
function typeOf(pathname, header) {
  if (header && header !== "application/octet-stream") return header;
  return TYPES[pathname.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,PUT,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "*",
};

/** A key and certificate for the names the stand-in answers to, good for a day, made by openssl. */
export function selfSigned() {
  const dir = mkdtempSync(path.join(tmpdir(), "oc-blob-"));
  const key = path.join(dir, "key.pem");
  const cert = path.join(dir, "cert.pem");
  execFileSync(
    "openssl",
    ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=vercel.com", "-addext", "subjectAltName=DNS:vercel.com,IP:127.0.0.1"],
    { stdio: "ignore" },
  );
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

export function startBlobStandIn(port, securePort, proxyPort) {
  /** pathname -> { body, type, uploadedAt } */
  const files = new Map();
  const blobUrl = (pathname) => `https://${HOST}/${pathname}`;

  const handle = async (request, response) => {
    // Through the tunnel the browser's paths carry the real endpoint's prefix.
    const url = new URL(request.url.replace(/^\/api\/blob(?=\/|\?|$)/, "") || "/", `http://127.0.0.1:${port}`);
    if (process.env.BLOB_STANDIN_LOG) console.log(`  [stand-in] ${request.method} ${request.url}`);
    const json = (status, body) => {
      response.writeHead(status, { ...CORS, "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (request.method === "OPTIONS") {
      response.writeHead(204, CORS);
      return response.end();
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    // A signed token. The SDK reads the store id and the scope out of the
    // first segment, and signs the browser's request with the second value.
    if (request.method === "POST" && url.pathname === "/signed-token") {
      const asked = JSON.parse(body.toString() || "{}");
      const payload = {
        storeId: STORE_ID,
        pathname: asked.pathname ?? "*",
        operations: asked.operations ?? ["get"],
        validUntil: asked.validUntil ?? Date.now() + 60 * 60 * 1000,
        maximumSizeInBytes: asked.maximumSizeInBytes,
        allowedContentTypes: asked.allowedContentTypes,
      };
      return json(200, {
        delegationToken: `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.standin`,
        clientSigningToken: "standin-signing-key",
        validUntil: payload.validUntil,
      });
    }

    // A file going up, from the browser with a signed address or from the server.
    if (request.method === "PUT" && url.pathname === "/") {
      const asked = url.searchParams.get("pathname") ?? "";
      if (!asked) return json(400, { error: { code: "bad_request", message: "pathname is required" } });
      const type = typeOf(asked, request.headers["x-content-type"] || request.headers["content-type"]);
      const suffix = request.headers["x-add-random-suffix"] === "0" ? "" : `-${randomBytes(6).toString("hex")}`;
      const dot = asked.lastIndexOf(".");
      const slash = asked.lastIndexOf("/");
      const pathname = dot > slash ? `${asked.slice(0, dot)}${suffix}${asked.slice(dot)}` : `${asked}${suffix}`;
      files.set(pathname, { body, type, uploadedAt: new Date() });
      return json(200, {
        url: blobUrl(pathname),
        downloadUrl: `${blobUrl(pathname)}?download=1`,
        pathname,
        contentType: type,
        contentDisposition: `inline; filename="${pathname.split("/").pop()}"`,
        etag: `"${randomBytes(8).toString("hex")}"`,
      });
    }

    if (request.method === "POST" && url.pathname === "/delete") {
      const { urls = [] } = JSON.parse(body.toString() || "{}");
      for (const item of urls) files.delete(new URL(item).pathname.slice(1));
      return json(200, {});
    }

    // A listing, by prefix.
    if (request.method === "GET" && url.pathname === "/") {
      const prefix = url.searchParams.get("prefix") ?? "";
      const blobs = [...files]
        .filter(([pathname]) => pathname.startsWith(prefix))
        .map(([pathname, file]) => ({
          url: blobUrl(pathname),
          downloadUrl: `${blobUrl(pathname)}?download=1`,
          pathname,
          size: file.body.length,
          uploadedAt: file.uploadedAt.toISOString(),
        }));
      return json(200, { blobs, cursor: null, hasMore: false });
    }

    // A file read back, in whole or, for a video being scrubbed, in part.
    if (request.method === "GET") {
      const file = files.get(url.pathname.slice(1));
      if (!file) {
        response.writeHead(404, CORS);
        return response.end();
      }
      const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range ?? "");
      if (match) {
        const total = file.body.length;
        const start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2]));
        const end = match[1] && match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
        response.writeHead(206, {
          ...CORS,
          "content-type": file.type,
          "content-length": String(end - start + 1),
          "content-range": `bytes ${start}-${end}/${total}`,
          "accept-ranges": "bytes",
        });
        return response.end(file.body.subarray(start, end + 1));
      }
      response.writeHead(200, {
        ...CORS,
        "content-type": file.type,
        "content-length": String(file.body.length),
        "accept-ranges": "bytes",
      });
      return response.end(file.body);
    }

    json(404, { error: { code: "not_found", message: `nothing at ${request.method} ${url.pathname}` } });
  };

  const server = createServer(handle);
  server.listen(port, "127.0.0.1");
  const secure = createSecureServer({ ...selfSigned(), allowHTTP1: true }, handle);
  if (process.env.BLOB_STANDIN_LOG) {
    secure.on("secureConnection", (socket) => console.log(`  [tls] ${socket.getProtocol()} alpn=${socket.alpnProtocol}`));
    secure.on("tlsClientError", (error) => console.log(`  [tls] client error: ${error.message}`));
  }
  secure.listen(securePort, "127.0.0.1");

  // The browser's proxy: vercel.com is tunnelled to the secure listener, the
  // app on this machine is passed through as it is, and anything else is
  // refused, so a suite can never reach the internet by it.
  const proxy = createServer((request, response) => {
    let target;
    try {
      target = new URL(request.url);
    } catch {
      target = null;
    }
    if (!target || !/^(127\.0\.0\.1|localhost)$/.test(target.hostname)) {
      response.writeHead(403);
      response.end();
      return;
    }
    const upstream = httpRequest(
      { host: target.hostname, port: target.port || 80, path: `${target.pathname}${target.search}`, method: request.method, headers: request.headers },
      (answer) => {
        response.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(response);
      },
    );
    upstream.on("error", () => {
      response.writeHead(502);
      response.end();
    });
    request.pipe(upstream);
  });
  proxy.on("connect", (request, socket, head) => {
    if (request.url !== "vercel.com:443") {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      return;
    }
    const upstream = net.connect(securePort, "127.0.0.1", () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });
  proxy.listen(proxyPort, "127.0.0.1");

  return { server, secure, proxy, files };
}
