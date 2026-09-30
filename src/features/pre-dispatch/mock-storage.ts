const storeKey="__gguardPreDispatchMockStorage";
type GlobalWithStore=typeof globalThis&{[storeKey]?:Map<string,{bytes:Uint8Array;contentType:string}>};
function store(){const root=globalThis as GlobalWithStore;root[storeKey]??=new Map();return root[storeKey]}
export function putMockObject(key:string,bytes:Uint8Array,contentType:string){store().set(key,{bytes,contentType})}
export function getMockObject(key:string){return store().get(key)}
