import { AuthUnified } from "@agency/auth-unified";
import { bindings } from "./bindings.server";

const env = bindings() as Record<string, string | undefined>;
export const auth = new AuthUnified(env.SMB_TOKEN || process.env.SMB_TOKEN!);