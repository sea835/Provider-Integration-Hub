export type ProviderDataSource = "mock" | "api";

export const PROVIDER_DATA_SOURCE: ProviderDataSource =
  process.env.NEXT_PUBLIC_PROVIDER_DATA_SOURCE === "api" ? "api" : "mock";

export const IS_PROVIDER_MOCK = PROVIDER_DATA_SOURCE === "mock";
