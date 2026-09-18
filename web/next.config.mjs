/**
 * The optional payment code paths inside the Coinbase Base Account connector, reached
 * through RainbowKit's connector bundle. This app never uses them, their packages are not
 * installed, and webpack will not finish a build with an unresolved import even on a
 * branch nothing takes. Stubbed to empty modules rather than pulled in as dependencies
 * that would ship to every visitor for a feature that does not exist here.
 */
const UNUSED_OPTIONAL_MODULES = [
  "@x402/core/client",
  "@x402/evm",
  "@x402/evm/exact/client",
  "@x402/evm/upto/client",
  "@x402/svm/exact/client",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {ignoreDuringBuilds: false},
  typescript: {ignoreBuildErrors: false},

  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      ...Object.fromEntries(UNUSED_OPTIONAL_MODULES.map((m) => [m, false])),
    };
    return config;
  },
};

export default nextConfig;
