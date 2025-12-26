/*! coi-serviceworker v0.1.7 - Guido Zuidhof, licensed under MIT */
let co = {
    shouldRegister: () => true,
    shouldDeregister: () => false,
    doReload: () => window.location.reload(),
    quiet: false,
    ...window.coi
}

const n = navigator;

if (co.shouldDeregister() && n.serviceWorker) {
    n.serviceWorker.getController().then(c => {
        c && c.unregister();
    });
} else if (co.shouldRegister()) {
    if (n.serviceWorker) {
        n.serviceWorker.register(window.document.currentScript.src).then(r => {
            if (!co.quiet) console.log("coi: registration succeeded. Scope is " + r.scope);

            r.addEventListener("updatefound", () => {
                !co.quiet && console.log("coi: update found", r);
                co.doReload()
            });

            if (r.active && !n.serviceWorker.controller) {
                !co.quiet && console.log("coi: active service worker found, reloading");
                co.doReload()
            }
        }, function (err) {
            !co.quiet && console.error("coi: registration failed: ", err);
        });
    }
} else {
    // In service worker environment
    if (self.serviceWorker) {
        self.addEventListener("install", () => self.skipWaiting());
        self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

        async function handleFetch(request) {
            if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
                return;
            }

            if (request.mode === "no-cors") {
                request = new Request(request.url, {
                    cache: request.cache,
                    credentials: "omit",
                    headers: request.headers,
                    integrity: request.integrity,
                    keepalive: request.keepalive,
                    method: request.method,
                    mode: request.mode,
                    redirect: request.redirect,
                    referrer: request.referrer,
                    referrerPolicy: request.referrerPolicy,
                    signal: request.signal,
                });
            }

            let r = await fetch(request).catch(e => console.error(e));

            if (r.status === 0) {
                return r;
            }

            const newHeaders = new Headers(r.headers);
            newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

            return new Response(r.body, {
                status: r.status,
                statusText: r.statusText,
                headers: newHeaders,
            });
        }

        self.addEventListener("fetch", function (e) {
            e.respondWith(handleFetch(e.request));
        });
    }
}
