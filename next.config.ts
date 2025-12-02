import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable instrumentation hook for cron jobs
  experimental: {
    instrumentationHook: true,
  },
  // Enable file watching in Docker for hot-reload
  webpackDevMiddleware: (config: any) => {
    config.watchOptions = {
      poll: 1000, // Check for changes every second
      aggregateTimeout: 300, // Delay before reloading
    };
    return config;
  },
};

export default nextConfig;
