import * as vscode from "vscode";
import { Snippet } from "./extension.interface";
import { ImportManager } from "./import-manager";

export class QuickPickManager {
  private readonly importManager: ImportManager;

  constructor(importManager: ImportManager) {
    this.importManager = importManager;
  }

  createQuickPick(
    snippets: Snippet[],
    editor: vscode.TextEditor
  ): vscode.QuickPick<any> {
    const quickPick = vscode.window.createQuickPick();

    if (snippets.length === 0) {
      quickPick.items = [
        {
          label: "No snippets found",
          description: "No snippets found for this file",
        },
      ];
      return quickPick;
    }

    quickPick.items = snippets.map((snippet) => ({
      label: snippet.label,
      description: `${snippet.package} - ${snippet.description}`,
      body: snippet.body,
      requiredImports: snippet.requiredImports,
    }));

    quickPick.placeholder = "Search package snippets...";

    quickPick.onDidAccept(async () => {
      const selection = quickPick.selectedItems[0] as vscode.QuickPickItem &
        Snippet;

      if (selection) {
        if (selection.requiredImports) {
          await this.importManager.addImportsIfNeeded(
            editor,
            selection.requiredImports
          );
        }

        const snippet = new vscode.SnippetString(selection.body);
        editor.insertSnippet(snippet);
      }
      quickPick.hide();
    });

    return quickPick;
  }
}
