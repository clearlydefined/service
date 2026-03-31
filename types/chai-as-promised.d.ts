// Type augmentation for chai-as-promised
declare namespace Chai {
  interface Assertion {
    // biome-ignore lint/complexity/noBannedTypes: chai-as-promised API uses Function as an error constructor type
    rejectedWith(errorLike?: Error | Function, errMsgMatcher?: string | RegExp, msg?: string): Assertion
    rejectedWith(errMsgMatcher?: string | RegExp, msg?: string): Assertion
  }
  interface PromisedAssertion extends Assertion {}
}
