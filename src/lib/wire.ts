import type {Wire} from "./asset-types";
/** Match the JSON API contract when supplying the same data directly from RSC. */
export function toWire<T>(value:T):Wire<T>{return JSON.parse(JSON.stringify(value)) as Wire<T>;}
