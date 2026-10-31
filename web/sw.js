/* Versão 4 — rede primeiro para evitar telas e ícones antigos na PWA.
   Só faz cache de arquivos estáticos da própria aplicação. */
const CACHE = "leitor-universal-web-v11";
const SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./finance-parser.js", "./agenda-parser.js", "./screen-capture.js", "./recording-reader.js",
               "./manifest.webmanifest", "./icon.svg", "./apple-touch-icon.png"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(
      keys.filter(k=>k.startsWith("leitor-universal-web-")&&k!==CACHE).map(k=>caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  // Atualização online primeiro. Offline fica apenas como fallback.
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(event.request,{cache:"no-store"});
      if(response.ok)await cache.put(event.request,response.clone());
      return response;
    }catch(error){
      const fallback=await cache.match(event.request,{ignoreSearch:true});
      if(fallback)return fallback;
      throw error;
    }
  })());
});
