export interface Env {
  GameServer: DurableObjectNamespace;
  DEMO_SERVER: DurableObjectNamespace;
  DB: D1Database;
  AUTH_SECRET: string;
  AXIOM_DATASET: string;
  AXIOM_TOKEN?: string;
  AXIOM_ORG_ID?: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_JWK: string;
  GAME_CLIENT_HOST: string;
  PERSONA_ASSETS_URL?: string;
}
