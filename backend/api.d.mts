export interface Credentials {apiKey:string;model:string;id:string;source:string}
export class ApiError extends Error {constructor(status:number,code:string,message:string);status:number;code:string}
export function credentials(request:Request,env:Record<string,string|undefined>,now?:number):Promise<Credentials|null>;
export function providerRequest(auth:Credentials,payload:Record<string,unknown>,fetcher?:typeof fetch,signal?:AbortSignal):Promise<any>;
export function handleApi(request:Request,env?:Record<string,string|undefined>,options?:{fetcher?:typeof fetch;now?:number}):Promise<Response>;
export const RESPONSE_SCHEMA:any;
export function validateResult(value:any,state:any,purpose:string):{reply:string;actions:any[]};
