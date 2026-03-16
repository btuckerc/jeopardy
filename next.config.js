const securityHeaders = [
    {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
    },
    {
        key: 'X-Frame-Options',
        value: 'DENY',
    },
    {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
    },
    {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
    },
]

const nextConfig = {
    // Enable instrumentation hook for cron jobs
    experimental: {
        instrumentationHook: true,
        serverComponentsExternalPackages: [
            '@xenova/transformers',
            'sharp',
            'onnxruntime-node',
        ],
    },
    webpack: (config, { isServer }) => {
        if (!isServer) {
            // For client-side, replace native packages with empty stubs
            config.resolve.alias = {
                ...config.resolve.alias,
                '@xenova/transformers': false,
                sharp: false,
                'onnxruntime-node': false,
            }

            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                path: false,
                crypto: false,
                stream: false,
                os: false,
            }
        }

        // Ignore .node binary files everywhere
        config.module.rules.push({
            test: /\.node$/,
            use: 'ignore-loader',
        })

        return config
    },
    async headers() {
        return [
            {
                source: '/:path*',
                headers: securityHeaders,
            },
        ]
    },
}

module.exports = nextConfig
