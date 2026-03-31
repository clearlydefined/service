// Type augmentation for chai-as-promised
declare namespace Chai {
  interface Assertion {
    rejectedWith(errorLike?: Error | Function, errMsgMatcher?: string | RegExp, msg?: string): Assertion
    rejectedWith(errMsgMatcher?: string | RegExp, msg?: string): Assertion
  }
  interface PromisedAssertion extends Assertion {}
}
