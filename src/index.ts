import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const STATE_FILE = path.join(os.tmpdir(), 'vscode-pdf-viewer-mcp-state.json');

interface PageInfo {
	pageNumber: number;
	text: string;
}

interface PdfState {
	pdfPath: string;
	pdfName: string;
	selection: { text: string; pageNumber: number | null };
	pages: PageInfo[];
}

function readState(): PdfState | null {
	try {
		return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
	} catch {
		return null;
	}
}

const server = new McpServer({
	name: 'pdf-viewer',
	version: '0.0.1',
});

server.tool(
	'get_pdf_selection',
	'Get the currently selected text in the VS Code PDF viewer, including the page number and PDF filename',
	{},
	async () => {
		const state = readState();
		if (!state) {
			return { content: [{ type: 'text' as const, text: 'No PDF is currently open in the viewer.' }] };
		}
		if (!state.selection?.text) {
			return { content: [{ type: 'text' as const, text: `PDF "${state.pdfName}" is open but no text is currently selected.` }] };
		}
		return {
			content: [{
				type: 'text' as const,
				text: `PDF: ${state.pdfName}\nFile: ${state.pdfPath}\nPage: ${state.selection.pageNumber}\n\nSelected text:\n${state.selection.text}`,
			}],
		};
	},
);

server.tool(
	'get_pdf_page_text',
	'Get the full text content of a specific page in the currently open PDF',
	{ pageNumber: z.number().int().positive().describe('The 1-based page number to retrieve text from') },
	async ({ pageNumber }) => {
		const state = readState();
		if (!state) {
			return { content: [{ type: 'text' as const, text: 'No PDF is currently open in the viewer.' }] };
		}
		const page = state.pages.find(p => p.pageNumber === pageNumber);
		if (!page) {
			return { content: [{ type: 'text' as const, text: `Page ${pageNumber} not found. The PDF "${state.pdfName}" has ${state.pages.length} pages.` }] };
		}
		return {
			content: [{
				type: 'text' as const,
				text: `PDF: ${state.pdfName}\nPage ${pageNumber} of ${state.pages.length}:\n\n${page.text}`,
			}],
		};
	},
);

server.tool(
	'search_pdf',
	'Search for text across all pages of the currently open PDF. Returns matching snippets with page numbers.',
	{ query: z.string().describe('Text to search for (case-insensitive)') },
	async ({ query }) => {
		const state = readState();
		if (!state) {
			return { content: [{ type: 'text' as const, text: 'No PDF is currently open in the viewer.' }] };
		}
		const results: string[] = [];
		const q = query.toLowerCase();
		for (const page of state.pages) {
			const lower = page.text.toLowerCase();
			let searchFrom = 0;
			while (true) {
				const idx = lower.indexOf(q, searchFrom);
				if (idx === -1) break;
				const start = Math.max(0, idx - 80);
				const end = Math.min(page.text.length, idx + query.length + 80);
				const snippet = (start > 0 ? '...' : '') + page.text.slice(start, end) + (end < page.text.length ? '...' : '');
				results.push(`Page ${page.pageNumber}: ${snippet}`);
				searchFrom = idx + query.length;
			}
		}
		if (results.length === 0) {
			return { content: [{ type: 'text' as const, text: `No results found for "${query}" in "${state.pdfName}".` }] };
		}
		return {
			content: [{
				type: 'text' as const,
				text: `Search results for "${query}" in "${state.pdfName}" (${results.length} match${results.length === 1 ? '' : 'es'}):\n\n${results.join('\n\n')}`,
			}],
		};
	},
);

server.tool(
	'get_pdf_info',
	'Get metadata about the currently open PDF: filename, path, total page count, and whether text is selected',
	{},
	async () => {
		const state = readState();
		if (!state) {
			return { content: [{ type: 'text' as const, text: 'No PDF is currently open in the viewer.' }] };
		}
		const hasSelection = Boolean(state.selection?.text);
		return {
			content: [{
				type: 'text' as const,
				text: [
					`PDF: ${state.pdfName}`,
					`File: ${state.pdfPath}`,
					`Pages: ${state.pages.length}`,
					`Has selection: ${hasSelection}${hasSelection ? ` (page ${state.selection.pageNumber})` : ''}`,
				].join('\n'),
			}],
		};
	},
);

server.tool(
	'get_pdf_full_text',
	'Get the complete text content of the entire PDF. Use get_pdf_page_text for individual pages if the document is large.',
	{},
	async () => {
		const state = readState();
		if (!state) {
			return { content: [{ type: 'text' as const, text: 'No PDF is currently open in the viewer.' }] };
		}
		const fullText = state.pages
			.map(p => `--- Page ${p.pageNumber} ---\n${p.text}`)
			.join('\n\n');
		return {
			content: [{
				type: 'text' as const,
				text: `PDF: ${state.pdfName} (${state.pages.length} pages)\n\n${fullText}`,
			}],
		};
	},
);

server.tool(
	'get_pdf_page_range',
	'Get text content from a range of pages in the currently open PDF',
	{
		startPage: z.number().int().positive().describe('First page number (1-based, inclusive)'),
		endPage: z.number().int().positive().describe('Last page number (1-based, inclusive)'),
	},
	async ({ startPage, endPage }) => {
		const state = readState();
		if (!state) {
			return { content: [{ type: 'text' as const, text: 'No PDF is currently open in the viewer.' }] };
		}
		if (startPage > endPage) {
			return { content: [{ type: 'text' as const, text: `Invalid range: startPage (${startPage}) must be <= endPage (${endPage}).` }] };
		}
		const rangePages = state.pages.filter(p => p.pageNumber >= startPage && p.pageNumber <= endPage);
		if (rangePages.length === 0) {
			return { content: [{ type: 'text' as const, text: `No pages found in range ${startPage}-${endPage}. The PDF has ${state.pages.length} pages.` }] };
		}
		const text = rangePages
			.map(p => `--- Page ${p.pageNumber} ---\n${p.text}`)
			.join('\n\n');
		return {
			content: [{
				type: 'text' as const,
				text: `PDF: ${state.pdfName}\nPages ${startPage}-${endPage} of ${state.pages.length}:\n\n${text}`,
			}],
		};
	},
);

server.tool(
	'get_pdf_context_around_selection',
	'Get the selected text along with the full text of the page it is on, giving surrounding context',
	{},
	async () => {
		const state = readState();
		if (!state) {
			return { content: [{ type: 'text' as const, text: 'No PDF is currently open in the viewer.' }] };
		}
		if (!state.selection?.text || !state.selection.pageNumber) {
			return { content: [{ type: 'text' as const, text: `PDF "${state.pdfName}" is open but no text is currently selected.` }] };
		}
		const page = state.pages.find(p => p.pageNumber === state.selection.pageNumber);
		if (!page) {
			return { content: [{ type: 'text' as const, text: `Could not find text for page ${state.selection.pageNumber}.` }] };
		}
		return {
			content: [{
				type: 'text' as const,
				text: [
					`PDF: ${state.pdfName}`,
					`Page: ${state.selection.pageNumber} of ${state.pages.length}`,
					``,
					`== Selected text ==`,
					state.selection.text,
					``,
					`== Full page text (for context) ==`,
					page.text,
				].join('\n'),
			}],
		};
	},
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch(console.error);
