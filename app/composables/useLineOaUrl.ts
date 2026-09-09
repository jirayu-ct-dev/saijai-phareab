const DEFAULT_LINE_OA_ID = "883vmdct";

export const useLineOaUrl = (): string => {
  const config = useRuntimeConfig();
  const oaId = String(config.public.lineOaId || DEFAULT_LINE_OA_ID).replace(/^@/, "");

  return `https://line.me/R/ti/p/@${oaId}`;
};
