import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  CodeAction,
  CodeActionKind,
  TextDocumentEdit,
  TextEdit,
  HoverParams,
  Hover,
  MarkupKind,
  Location,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

import { StaticAnalyzer } from './analyzers/static';
import { LLMAnalyzer } from './analyzers/llm';
import { parsePromptDocument } from './parsing';
import { AnalysisResult, LLMProxyRequest, LLMProxyResponse } from './types';
import {
  createCodeLenses,
  findCompositionLinkAtPosition,
  findFirstVariableOccurrence,
  getVariableNameAtPosition,
  resultsToDiagnostics,
} from './lspFeatures';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

const staticAnalyzer = new StaticAnalyzer();
const llmAnalyzer = new LLMAnalyzer();

let workspaceRoot: string | undefined;

// Store last analysis results per URI for CodeLens issue summary
const lastStaticAnalysisResults: Map<string, AnalysisResult[]> = new Map();

connection.onInitialize((params: InitializeParams) => {
  // Capture workspace root for path traversal validation
  if (params.rootUri) {
    try { workspaceRoot = fileURLToPath(params.rootUri); } catch { /* ignore */ }
  } else if (params.workspaceFolders && params.workspaceFolders.length > 0) {
    try { workspaceRoot = fileURLToPath(params.workspaceFolders[0].uri); } catch { /* ignore */ }
  }

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Incremental,
        save: { includeText: false },
      },
      hoverProvider: true,
      codeActionProvider: {
        codeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.Refactor],
      },
      documentSymbolProvider: true,
      definitionProvider: true,
      codeLensProvider: { resolveProvider: false },
    },
  };

  if (params.capabilities.workspace?.workspaceFolders) {
    result.capabilities.workspace = {
      workspaceFolders: { supported: true },
    };
  }

  return result;
});

connection.onInitialized(() => {
  connection.console.log('Prompt LSP initialized');

  // Set up LLM proxy: server sends requests to client, client calls vscode.lm
  llmAnalyzer.setProxyFn(async (request: LLMProxyRequest): Promise<LLMProxyResponse> => {
    try {
      const response = await connection.sendRequest<LLMProxyResponse>('promptLSP/llmRequest', request);
      return response;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Proxy request failed';
      return { text: '{}', error: msg };
    }
  });
});

function getPromptDocument(textDocument: TextDocument) {
  return parsePromptDocument({ uri: textDocument.uri, text: textDocument.getText(), workspaceRoot });
}

// Analysis is triggered manually via the command / status bar button only.
async function runFullAnalysis(textDocument: TextDocument): Promise<void> {
  const uri = textDocument.uri;
  const promptDoc = getPromptDocument(textDocument);

  const staticResults = staticAnalyzer.analyze(promptDoc);
  lastStaticAnalysisResults.set(uri, staticResults);

  const llmResults = await llmAnalyzer.analyze(promptDoc);

  const diagnostics = resultsToDiagnostics([...staticResults, ...llmResults]);
  connection.sendDiagnostics({ uri, diagnostics });
  connection.console.log(`[Analysis] Sent ${diagnostics.length} diagnostics for ${uri}`);
}

// Go to Definition for variables and composition links
connection.onDefinition((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const promptDoc = getPromptDocument(document);
  const position = params.position;
  const lineText = promptDoc.lines[position.line] ?? '';

  const variableName = getVariableNameAtPosition(lineText, position.character);
  if (variableName) {
    const occurrence = findFirstVariableOccurrence(promptDoc, variableName);
    if (occurrence) {
      return Location.create(params.textDocument.uri, {
        start: { line: occurrence.line, character: occurrence.character },
        end: { line: occurrence.line, character: occurrence.character + occurrence.length },
      });
    }
  }

  const link = findCompositionLinkAtPosition(promptDoc, position.line, position.character);
  if (link?.resolvedPath) {
    try {
      fs.accessSync(link.resolvedPath, fs.constants.R_OK);
      const targetUri = pathToFileURL(link.resolvedPath).toString();
      return Location.create(targetUri, {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      });
    } catch {
      // File not accessible
    }
  }

  return null;
});

connection.onCodeLens((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const promptDoc = getPromptDocument(document);
  return createCodeLenses(
    promptDoc,
    lastStaticAnalysisResults.get(params.textDocument.uri),
    staticAnalyzer,
  );
});

connection.onHover((params: HoverParams): Hover | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return null;

  const position = params.position;
  const line = document.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line + 1, character: 0 },
  });

  const variablePattern = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = variablePattern.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (position.character >= start && position.character <= end) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: `**Variable:** \`${match[1]}\`\n\nThis variable will be interpolated at runtime. Ensure it's defined in your context.`,
        },
      };
    }
  }

  return null;
});

connection.onCodeAction((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const codeActions: CodeAction[] = [];

  for (const diagnostic of params.context.diagnostics) {
    if (!diagnostic.source?.startsWith('prompt-lsp')) continue;

    if (diagnostic.data) {
      const suggestion = diagnostic.data as string;
      const title = diagnostic.code === 'ambiguous-quantifier'
        ? `Replace with "${suggestion}"`
        : `Fix: ${suggestion}`;
      codeActions.push({
        title,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          documentChanges: [
            TextDocumentEdit.create(
              { uri: params.textDocument.uri, version: document.version },
              [TextEdit.replace(diagnostic.range, suggestion)]
            ),
          ],
        },
      });
    }
  }

  return codeActions;
});

connection.onDocumentSymbol((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const promptDoc = getPromptDocument(document);
  return promptDoc.sections.map((section) => ({
    name: section.name,
    kind: 15, // SymbolKind.String
    range: {
      start: { line: section.startLine, character: 0 },
      end: { line: section.endLine, character: 0 },
    },
    selectionRange: {
      start: { line: section.startLine, character: 0 },
      end: { line: section.startLine, character: section.name.length + 2 },
    },
  }));
});

// Handle manual analysis trigger from client
connection.onNotification('promptLSP/analyze', (params: { uri: string }) => {
  const document = documents.get(params.uri);
  if (document) {
    runFullAnalysis(document);
  }
});

// Token count request for client status bar
connection.onRequest('promptLSP/tokenCount', (params: { uri: string }): number => {
  const document = documents.get(params.uri);
  if (!document) return 0;
  return staticAnalyzer.getTokenCount(document.getText());
});

// Clean up per-document state when documents are closed
documents.onDidClose((event) => {
  lastStaticAnalysisResults.delete(event.document.uri);
});

documents.listen(connection);

connection.onShutdown(() => {
  staticAnalyzer.dispose();
});

connection.listen();
