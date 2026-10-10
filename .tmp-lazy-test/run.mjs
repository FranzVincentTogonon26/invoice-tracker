import { createMemoryRouter } from "react-router";

async function probe(name, routes) {
  const router = createMemoryRouter(routes, { initialEntries: ["/a"] });
  const done = new Promise((resolve) => {
    const unsub = router.subscribe((state) => {
      if (state.initialized && state.navigation.state === "idle") {
        unsub();
        resolve(state);
      }
    });
  });
  router.initialize();
  const state = await done;
  const match = state.matches[state.matches.length - 1];
  const el = match.route.element;
  const hasElement = el != null;
  const isReactEl = hasElement && typeof el === "object" && el.$$typeof !== undefined;
  console.log(`${name}: element=${hasElement} isReactElement=${isReactEl}`);
}

// Pattern 1: raw module namespace with default export
await probe("raw import()", [
  { path: "/a", lazy: () => import("./mod-a.mjs") },
]);

// Pattern 2: explicit { Component }
await probe("{ Component } wrapper", [
  { path: "/a", lazy: async () => ({ Component: (await import("./mod-b.mjs")).default }) },
]);
process.exit(0);
