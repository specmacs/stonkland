/**
 * Lets the generator import the app's TypeScript modules directly.
 *
 * Node's type stripping resolves relative specifiers literally, while the app is written
 * for a bundler that fills in extensions. This adds the extension back rather than
 * littering the application source with `.js` suffixes for a script's benefit.
 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      // Fall through to the default resolution and let it report the real problem.
    }
  }
  return next(specifier, context);
}
