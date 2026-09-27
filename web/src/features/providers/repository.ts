import { IS_PROVIDER_MOCK } from "./config";
import { httpProviderRepository } from "./http-repository";
import { mockProviderRepository } from "./mock-repository";
import type { ProviderRepository } from "./types";

export const providerRepository: ProviderRepository = IS_PROVIDER_MOCK
  ? mockProviderRepository
  : httpProviderRepository;
