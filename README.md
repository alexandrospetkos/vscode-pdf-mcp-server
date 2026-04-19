# VS Code PDF Viewer MCP Server

A Model Context Protocol (MCP) server that exposes tools for reading and searching PDFs opened in the VS Code PDF viewer extension.

## Tools

- **get_pdf_info** - Get metadata about the open PDF (filename, path, page count, selection status)
- **get_pdf_selection** - Get the currently selected text, including page number
- **get_pdf_context_around_selection** - Get the selected text plus the full page text for context
- **get_pdf_page_text** - Get the text content of a specific page
- **get_pdf_page_range** - Get text content from a range of pages
- **get_pdf_full_text** - Get the complete text of the entire PDF
- **search_pdf** - Search for text across all pages (case-insensitive)

## Setup

### Build

```bash
npm install
npm run build
```

### Add to Your Workspace

The `workspace-config/` folder contains ready-to-use config files for your target workspace:

1. Copy `workspace-config/settings.json` to `<your-workspace>/.claude/settings.json` and update the path to point to `build/index.js` in this repo.
2. Copy `workspace-config/CLAUDE.md` to `<your-workspace>/CLAUDE.md` to give Claude instructions on how to use the PDF tools.
