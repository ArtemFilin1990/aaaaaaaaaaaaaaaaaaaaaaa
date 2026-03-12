import "../../worker-configuration";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {}
}
