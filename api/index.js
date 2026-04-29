export const config = { runtime: "edge" };
const DEST = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

export default async function (req) {
  const url = new URL(req.url);
  // مسیر مخفی را کمی ساده‌تر کردیم که با نام فایل index تداخل نکند
  const secretPath = "/api/data-stream"; 

  if (url.pathname.startsWith(secretPath)) {
    try {
      const remainingPath = url.pathname.replace(secretPath, "");
      const targetUrl = DEST + (remainingPath.startsWith("/") ? remainingPath : "/" + remainingPath) + url.search;
      
      const newHeaders = new Headers(req.headers);
      newHeaders.delete("host");
      return await fetch(targetUrl, {
        method: req.method,
        headers: newHeaders,
        body: req.body,
        redirect: "manual",
      });
    } catch (e) {
      return new Response("Bridge Error", { status: 502 });
    }
  }

  // صفحه صوری
  return new Response(`<html><body style="background:#000;color:#0f0;display:flex;justify-content:center;align-items:center;height:100vh;">
    <div>[+] System Monitoring Active...</div></body></html>`, {
    headers: { "content-type": "text/html" },
  });
}
