export class TrustedPreProviderResolver {
  resolveCanonicalInputs() {
    return {
      runConfig: {},
      cutoff: new Date()
    };
  }
}
