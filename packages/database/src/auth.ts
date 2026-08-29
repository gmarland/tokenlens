import {createHash,timingSafeEqual} from "node:crypto";import {db,Workspace} from "./index";
export const hashKey=(key:string)=>createHash("sha256").update(key).digest("hex");
export async function authenticate(header:string|null){if(!header?.startsWith("Bearer "))return null;const digest=hashKey(header.slice(7));const workspace=await (await db()).getRepository(Workspace).findOneBy({ingestKeyHash:digest});if(!workspace)return null;const a=Buffer.from(workspace.ingestKeyHash),b=Buffer.from(digest);return a.length===b.length&&timingSafeEqual(a,b)?workspace:null}
