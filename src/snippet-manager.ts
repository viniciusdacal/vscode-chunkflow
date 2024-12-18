import * as vscode from "vscode";
import { Snippet } from "./extension.interface";
import { PackageManager } from "./package-manager";

export class SnippetManager {
  private readonly snippetCache: Map<string, Snippet[]>;
  private readonly packageManager: PackageManager;

  constructor(packageManager: PackageManager) {
    this.snippetCache = new Map();
    this.packageManager = packageManager;
  }

  matchesScope(scope: string, document: vscode.TextDocument): boolean {
    if (!scope) {
      return true;
    }
    const scopes = Array.isArray(scope) ? scope : scope.split(",");
    return scopes.some((s) => document.languageId.match(s.trim()));
  }

  async findAndCacheSnippets(
    document: vscode.TextDocument,
    workspacePath: string,
    packageName?: string
  ): Promise<Snippet[]> {
    const snippets: Snippet[] = [];
    const packageSnippets = await this.packageManager.findPackageSnippets(
      workspacePath,
      packageName
    );

    if (packageSnippets?.snippets) {
      const filteredSnippets = packageSnippets.snippets.filter((s) =>
        this.matchesScope(s.scope, document)
      );
      this.snippetCache.set(packageName ?? "_workspace", filteredSnippets);
      snippets.push(...filteredSnippets);
    }

    return snippets;
  }

  async getRelevantSnippets(document: vscode.TextDocument): Promise<Snippet[]> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      return [];
    }

    const snippets = await this.packageManager.findPackageSnippets(
      workspaceFolder.uri.fsPath
    );

    if (!snippets?.snippets) {
      return [];
    }

    return snippets.snippets;
  }
}
