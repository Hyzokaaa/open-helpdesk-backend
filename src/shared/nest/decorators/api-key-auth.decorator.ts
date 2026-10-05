import { SetMetadata } from '@nestjs/common';

export const ACCEPTS_API_KEY = 'acceptsApiKey';

/**
 * Opts a controller or route into API key authentication. Everywhere else an `ohd_` key is
 * refused, so a key never acts as its creator outside the scoped, workspace-bound public API.
 */
export const ApiKeyAuth = () => SetMetadata(ACCEPTS_API_KEY, true);
