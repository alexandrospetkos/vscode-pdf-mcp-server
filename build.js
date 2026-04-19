const esbuild = require('esbuild');
const production = process.argv.includes('--production');

esbuild.build({
	entryPoints: ['src/index.ts'],
	bundle: true,
	format: 'cjs',
	minify: production,
	sourcemap: !production,
	platform: 'node',
	outfile: 'dist/index.js',
}).catch(() => process.exit(1));
