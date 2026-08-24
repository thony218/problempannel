import type { AppUser } from "../db/users";

export interface AppVariables {
  requestId: string;
  user: AppUser;
}

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
