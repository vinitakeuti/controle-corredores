import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    const isDevelopment = process.env.NODE_ENV !== "production";
    const scriptSource = isDevelopment
      ? "'self' 'unsafe-inline' 'unsafe-eval' https://scripts.appmax.com.br"
      : "'self' 'unsafe-inline' https://scripts.appmax.com.br";
    const connectSource = isDevelopment
      ? "'self' ws: wss: https://hdixjlm06b.execute-api.sa-east-1.amazonaws.com"
      : "'self' https://hdixjlm06b.execute-api.sa-east-1.amazonaws.com";
    const headers = [
      { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src ${scriptSource}; connect-src ${connectSource}; font-src 'self' data:` },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    ];

    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
