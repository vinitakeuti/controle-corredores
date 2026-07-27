export function isSameOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  // Host is the authority received by this application. Do not use a client-
  // supplied X-Forwarded-Host here, or it could be used to bypass this check.
  const host = request.headers.get("host") || requestUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || requestUrl.protocol.replace(":", "");
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      return originUrl.protocol === `${protocol}:` && originUrl.host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return refererUrl.protocol === `${protocol}:` && refererUrl.host === host;
    } catch {
      return false;
    }
  }

  // Non-browser clients may omit Origin/Referer. SameSite cookies still protect
  // browser requests, while an explicit cross-site fetch is always rejected.
  return request.headers.get("sec-fetch-site") !== "cross-site";
}

export function noStoreHeaders() {
  return { "Cache-Control": "no-store, max-age=0" };
}

export function publicUrl(request: Request, path: string) {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") || requestUrl.host;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || requestUrl.protocol.replace(":", "");
  return new URL(path, `${protocol}://${host}`).toString();
}
