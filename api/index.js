import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const config = {
  api: { bodyParser: false },
  supportsResponseStreaming: true,
  maxDuration: 60,
};

const REMOTE_ORIGIN = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const BLOCKED_HEADERS = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate", 
  "proxy-authorization", "te", "trailer", "transfer-encoding", 
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port"
]);

export default async function edgeRuntime(req, res) {
  if (!REMOTE_ORIGIN) {
    res.statusCode = 500;
    return res.end("Service Configuration Error");
  }

  try {
    const upstreamUrl = REMOTE_ORIGIN + req.url;
    const outboundHeaders = {};
    let realClientIp = null;

    for (const [key, value] of Object.entries(req.headers)) {
      const lowKey = key.toLowerCase();
      if (BLOCKED_HEADERS.has(lowKey) || lowKey.startsWith("x-vercel-")) continue;
      if (lowKey === "x-real-ip" || lowKey === "x-forwarded-for") {
        realClientIp = Array.isArray(value) ? value[0] : value;
        continue;
      }
      outboundHeaders[lowKey] = Array.isArray(value) ? value.join(", ") : value;
    }
    
    if (realClientIp) outboundHeaders["x-forwarded-for"] = realClientIp;

    const requestOptions = {
      method: req.method,
      headers: outboundHeaders,
      redirect: "manual"
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      requestOptions.body = Readable.toWeb(req);
      requestOptions.duplex = "half";
    }

    const upstreamResponse = await fetch(upstreamUrl, requestOptions);

    res.statusCode = upstreamResponse.status;
    for (const [k, v] of upstreamResponse.headers) {
      if (k.toLowerCase() !== "transfer-encoding") {
        try { res.setHeader(k, v); } catch (e) {}
      }
    }

    if (upstreamResponse.body) {
      await pipeline(Readable.fromWeb(upstreamResponse.body), res);
    } else {
      res.end();
    }
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end("Edge Gateway Error");
    }
  }
}
