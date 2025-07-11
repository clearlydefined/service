# TypeScript Migration Strategy

This document outlines our current TypeScript migration strategy for the ClearlyDefined service.
We are taking a gradual, incremental approach to improve type safety while maintaining backward compatibility.

## Current State

### What We Have

- **TypeScript Compiler Configuration**: We use TypeScript primarily for type checking JavaScript files via `tsconfig.json`
- **Type Definition Files**: `.d.ts` files provide type information
- **JSDoc Type Annotations**: Many JavaScript files include JSDoc comments for better IDE support and basic type checking
- **TypeScript Checking**: The `tsc` command runs as part of our lint process to catch type errors

### Current TypeScript Configuration

See [`tsconfig.json`][tsconfig] for the current configuration.

**Key aspects of our current setup:**

- **Extends strictest TypeScript configuration**: Uses [`@tsconfig/strictest`][tsconfig-strictest] for maximum type safety, with [`@tsconfig/node18`][tsconfig-node18] for Node.js compatibility
- **JavaScript type checking**: `allowJs: true` and `checkJs: true` enable TypeScript to analyze JavaScript files
- **No compilation**: `noEmit: true` means we only do type checking, no compilation to JavaScript
- **Selective strictness**: `strictNullChecks: false` and `exactOptionalPropertyTypes: false` are disabled as they're difficult to enforce in JavaScript
- **Expanding coverage**: The `include` array covers many core library files and their type definitions

## How to Add New Types

### 1. Create Type Definition Files

For JavaScript modules that need types, create corresponding `.d.ts` files

### 2. Add JSDoc Type Annotations

For existing JavaScript files, add JSDoc comments with type information

### 3. Extend TypeScript Checking

To include new files in TypeScript checking, add them to the `include` array in [`tsconfig.json`][tsconfig]:

```json
{
  "include": [
    // Existing files
    // ...
    "your/new/file.js" // Add new files here
  ]
}
```

## Future Migration Path

### Near-term

1. **Expand Type Coverage**: Add `.d.ts` files for more JavaScript modules
1. **Enhanced JSDoc**: Improve existing JSDoc annotations across the codebase
1. **Incremental TypeScript Checking**: Gradually add more files to the `include` list

### Medium-term

We have several options for deeper TypeScript integration:

#### Option 1: Node.js Native TypeScript Support

Node.js 22.6+ offers native TypeScript support with type stripping:

**Advantages:**

- No build step required
- Lightweight type stripping only
- Compatible with existing tooling

**Requirements:**

- [Node.js 22.6+ with `--experimental-strip-types` flag or Node.js 23.6+][node-typescript], or
- [TypeScript 5.8+ with `erasableSyntaxOnly` enabled][ts-node-native]

**Limitations:**

- Only erasable TypeScript syntax (no enums, namespaces with runtime code, parameter properties)
- Must use explicit `import type` syntax
- File extensions required in imports (e.g., `import './file.ts'`)

#### Option 2: Build-based TypeScript

Traditional TypeScript compilation with a build step:

**Advantages:**

- Full TypeScript feature support
- Better IDE integration
- Stronger type checking

**Requirements:**

- Add build process to deployment pipeline
- Update package.json scripts
- Handle source maps and debugging

## Getting Started

To contribute type definitions:

1. Identify a JavaScript module that would benefit from types
1. Create a corresponding `.d.ts` file with appropriate interfaces and type definitions
1. Use the types in JSDoc comments or import them in JavaScript files
1. Add the file to the TypeScript `include` configuration in [`tsconfig.json`][tsconfig] if it's not already covered
1. Test the types by running `npm run tsc`
1. Update this document as we learn and evolve our approach

[tsconfig]: ../tsconfig.json
[tsconfig-strictest]: https://www.npmjs.com/package/@tsconfig/strictest
[tsconfig-node18]: https://www.npmjs.com/package/@tsconfig/node18
[node-typescript]: https://nodejs.org/api/cli.html#cli_node_experimental_strip_types
[ts-node-native]: https://devblogs.microsoft.com/typescript/announcing-typescript-5-8-beta/#the---erasablesyntaxonly-option
