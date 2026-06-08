const suspiciousPatterns = [
  /\.\.\//i,
  /\.\.%2f/i,
  /%2e%2e/i,
  /etc\/passwd/i,
  /%00/i,
  /metadata\.google\.internal/i,
  /169\.254\.169\.254/i,
  /127\.0\.0\.1/i,
  /localhost/i,
  /ip6-localhost/i,
  /\[::1\]/i,
];

const suspiciousPaths = new Set([
  "/api/fetch",
]);

export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  const target = `${url.pathname}${url.search}`;

  if (suspiciousPaths.has(url.pathname) || suspiciousPatterns.some((pattern) => pattern.test(target))) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
    });
  }
});
