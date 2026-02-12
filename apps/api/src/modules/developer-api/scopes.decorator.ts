import { SetMetadata } from "@nestjs/common";

export const DEVELOPER_API_SCOPES_KEY = "developer_api_scopes";

export const DeveloperApiScopes = (...scopes: string[]) => SetMetadata(DEVELOPER_API_SCOPES_KEY, scopes);
