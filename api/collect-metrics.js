export const config = {
  runtime: "edge",
};

const DEST = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

// کد HTML مستقیماً داخل متغیر قرار می‌گیرد تا فایل index.html هم حذف شود
const template = `
<!DOCTYPE HTML>
<html lang="en">
<head>
    <title>Analytics Dashboard</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
        body { background: #0b0e14; color: #4e5b73; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .box { border: 1px solid #1c222d; padding: 20px; border-radius: 8px; text-align: center; }
        .pulse { display: inline-block; width: 10px; height: 10px; background: #2ecc71; border-radius: 50%; margin-right: 10px; }
    </style>
</head>
<body>
    <div class="box">
        <span class="pulse"></span> System Monitoring Active
    </div>
</body>
</html>
`;

export default async function (req) {
  const url = new URL(req.url);

  // یک مسیر بسیار طولانی و رندوم که حدس زدنش غیرممکن باشد
  const secretPath = "/api/v1/internal/logs/stream/data/7db92ae"; 

  if (url.pathname.startsWith(secretPath)) {
    try {
      const targetUrl = DEST + url.pathname.replace(secretPath, "") + url.search;
      const newHeaders = new Headers(req.headers);
      newHeaders.delete("host");
      newHeaders.delete("x-vercel-id");

      return await fetch(targetUrl, {
        method: req.method,
        headers: newHeaders,
        body: req.body,
        redirect: "manual",
      });
    } catch (e) {
      return new Response(null, { status: 500 });
    }
  }

  // در تمام مسیرهای دیگر، فقط صفحه مانیتورینگ صوری نشان داده می‌شود
  return new Response(template, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
