// @ts-check

import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';
import { defineConfig, fontProviders } from 'astro/config';
import rehypeWrapTables from './src/plugins/rehype-wrap-tables';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';

export default defineConfig({
	site: 'https://secd0g.github.io',
	base: '/zen',
	vite: {},
	integrations: [
		expressiveCode({
			themes: ['github-light', 'github-dark'],
			defaultProps: {
				wrap: true,
				showLineNumbers: true,
				frame: 'terminal',
			},
			plugins : [pluginLineNumbers()],
			styleOverrides: {
    			codeFontSize: '0.875rem',
    			codeFontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    			codeLineHeight: '1.7142857em',
    			borderRadius: '0.5rem',
    			borderWidth: '1px',
    			codePaddingBlock: '0.75rem',
    			codePaddingInline: '1rem',
			},
			frames: {
				showCopyToClipboardButton: true,
			},
			useDarkModeMediaQuery: false,
			themeCssSelector: (theme) => {
				if (theme.name === 'github-dark') return '.dark';
				return false;
			},
		}),
		sitemap(),
	],
	markdown: {
		rehypePlugins: [rehypeWrapTables],
		syntaxHighlight: false,
	},
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{ src: ['./src/assets/fonts/atkinson-regular.woff'], weight: 400, style: 'normal', display: 'swap' },
					{ src: ['./src/assets/fonts/atkinson-bold.woff'], weight: 700, style: 'normal', display: 'swap' },
				],
			},
		},
	],
});
