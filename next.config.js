/** @type {import('next').NextConfig} */
const nextConfig = {
    // Exclude native modules from client-side bundling
    experimental: {
        serverComponentsExternalPackages: ['@xenova/transformers', 'sharp', 'onnxruntime-node'],
    },
    webpack: (config, { isServer }) => {
        if (!isServer) {
            // For client-side, completely replace these modules with empty stubs
            config.resolve.alias = {
                ...config.resolve.alias,
                '@xenova/transformers': false,
                'sharp': false,
                'onnxruntime-node': false,
            };
            
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                path: false,
                crypto: false,
                stream: false,
                os: false,
            };
        }
        
        // Ignore .node binary files everywhere
        config.module.rules.push({
            test: /\.node$/,
            use: 'ignore-loader',
        });
        
        return config;
    },
}

module.exports = nextConfig