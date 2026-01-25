// Type definitions for tiny-attribution-generator
// Project: https://github.com/nickolashkraus/tiny-attribution-generator

declare module 'tiny-attribution-generator/lib/docbuilder' {
  export class DocBuilder {
    constructor(renderer?: any)
    read(input: any): Promise<void>
    build(): string
  }
  export default DocBuilder
}

declare module 'tiny-attribution-generator/lib/outputs/text' {
  export class TextRenderer {
    constructor(options?: any)
  }
  export default TextRenderer
}

declare module 'tiny-attribution-generator/lib/outputs/html' {
  export class HtmlRenderer {
    constructor(options?: any)
  }
  export default HtmlRenderer
}

declare module 'tiny-attribution-generator/lib/outputs/template' {
  export class TemplateRenderer {
    constructor(template?: string)
  }
  export default TemplateRenderer
}

declare module 'tiny-attribution-generator/lib/outputs/json' {
  export class JsonRenderer {
    constructor(options?: any)
  }
  export default JsonRenderer
}

declare module 'tiny-attribution-generator/lib/inputs/json' {
  export class JsonSource {
    constructor(data: any)
  }
  export default JsonSource
}
