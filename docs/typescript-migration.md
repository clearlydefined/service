# TypeScript migration

We're gradually adding TypeScript to the ClearlyDefined service. The approach: use `tsc` to type-check our existing JavaScript, write `.d.ts` files for type information, and avoid a build step. Nobody is rewriting the whole thing.

## Where we are

We run TypeScript as a linter, not a compiler. `tsc` checks JavaScript files via `allowJs` and `checkJs`, and `noEmit` means it never produces output. This runs as part of `npm run lint`.

Type information comes from three places:

- `.d.ts` files sitting next to their corresponding `.js` modules
- JSDoc annotations in the JavaScript itself
- custom type definitions in `types/` for third-party packages that don't ship their own types and aren't covered by DefinitelyTyped (`@types/` packages)

Tests can be `.ts` files. Mocha runs both `test/**/*.js` and `test/**/*.ts`, and the tsconfig includes the `.ts` glob. There's one TypeScript test file so far.

### tsconfig.json

The config extends three bases:

- [`@tsconfig/strictest`][tsconfig-strictest] — strict defaults
- [`@tsconfig/node24`][tsconfig-node24] — Node 24 target and lib settings
- [`@tsconfig/node-ts`][tsconfig-node-ts] — enables `erasableSyntaxOnly` for Node's native type stripping

We override a few strict options because they don't play well with JavaScript:

- `strictNullChecks: false`
- `exactOptionalPropertyTypes: false`
- `noPropertyAccessFromIndexSignature: false`

We also set `verbatimModuleSyntax: false`, overriding the `node-ts` default. Without this, all our CommonJS `require()` calls would be errors. Once we migrate imports, we can flip it back.

Other settings: `resolveJsonModule: true` (we import JSON in a few places).

## Adding types

Write a `.d.ts` file next to the JavaScript module. Add JSDoc annotations to the `.js` file where they help. Then add both to the `include` array in [`tsconfig.json`][tsconfig]:

```json
{ "include": ["your/new/file.d.ts", "your/new/file.js"] }
```

Run `npm run tsc` to check your work.

New tests can just be `.ts` files in `test/`. They're picked up automatically.

## What's next

### Native TypeScript in Node.js

Most of the groundwork is done. Node 24 runs `.ts` files natively by stripping types at import time, no build needed. The tsconfig already has `erasableSyntaxOnly` enabled via `@tsconfig/node-ts`.

Before we can write source files (not just tests) in `.ts`, we need to:

1. Sort out `verbatimModuleSyntax` — either migrate existing imports to use `import type` or keep the override
2. Pick a convention for file extensions in imports (`import './foo.ts'` is required with type stripping)
3. Decide what to do with `bin/www` — update the entry point or let Node handle it

Type stripping has restrictions: no enums, no namespaces with runtime code, no parameter properties. For this codebase that's probably fine since we don't use any of those.

### Build-based TypeScript (the other option)

A traditional `tsc` build step would remove the syntax restrictions and give us enums, decorators, and everything else. The cost is adding a build to the deployment pipeline and dealing with source maps. We haven't needed this yet.

## Getting started

1. Find a `.js` file that doesn't have a `.d.ts` yet
2. Write the type definitions
3. Add both files to `tsconfig.json`'s `include` list
4. Run `npm run tsc`
5. If something in this doc is wrong, fix it

[tsconfig]: ../tsconfig.json
[tsconfig-strictest]: https://www.npmjs.com/package/@tsconfig/strictest
[tsconfig-node24]: https://www.npmjs.com/package/@tsconfig/node24
[tsconfig-node-ts]: https://www.npmjs.com/package/@tsconfig/node-ts
[node-typescript]: https://nodejs.org/api/typescript.html
