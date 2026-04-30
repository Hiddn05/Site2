import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const config = {
  api: { bodyParser: false },
  supportsResponseStreaming: true,
  maxDuration: 60,
};

const DEST_ENDPOINT = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const EXCLUDED_HEADERS = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate",
  "proxy-authorization", "te", "trailer", "transfer-encoding",
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function handleRequest(req, res) {
  if (!DEST_ENDPOINT) {
    res.statusCode = 500;
    return res.end("System Error: ENV missing");
  }

  try {
    const finalUrl = DEST_ENDPOINT + req.url;
    const reqHeaders = {};
    let cIp = null;

    for (const key of Object.keys(req.headers)) {
      const lowerKey = key.toLowerCase();
      const val = req.headers[key];
      
      if (EXCLUDED_HEADERS.has(lowerKey) || lowerKey.startsWith("x-vercel-")) continue;
      if (lowerKey === "x-real-ip") { cIp = val; continue; }
      if (lowerKey === "x-forwarded-for") { if (!cIp) cIp = val; continue; }
      
      reqHeaders[lowerKey] = Array.isArray(val) ? val.join(", ") : val;
    }
    if (cIp) reqHeaders["x-forwarded-for"] = cIp;

    const reqMethod = req.method;
    const isPayloadCarrier = reqMethod !== "GET" && reqMethod !== "HEAD";

    const configOpts = { method: reqMethod, headers: reqHeaders, redirect: "manual" };
    if (isPayloadCarrier) {
      configOpts.body = Readable.toWeb(req);
      configOpts.duplex = "half";
    }

    const remoteResponse = await fetch(finalUrl, configOpts);

    res.statusCode = remoteResponse.status;
    for (const [hk, hv] of remoteResponse.headers) {
      if (hk.toLowerCase() === "transfer-encoding") continue;
      try { res.setHeader(hk, hv); } catch {}
    }

    if (remoteResponse.body) {
      await pipeline(Readable.fromWeb(remoteResponse.body), res);
    } else {
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end("Gateway Timeout");
    }
  }
}
