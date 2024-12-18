import * as vscode from "vscode";
import { ImportManager } from "./import-manager";
import { PackageManager } from "./package-manager";
import { QuickPickManager } from "./quick-pick-manager";
import { SnippetManager } from "./snippet-manager";

export function activate(context: vscode.ExtensionContext) {
  const importManager = new ImportManager();
  const packageManager = new PackageManager();
  const snippetManager = new SnippetManager(packageManager);
  const quickPickManager = new QuickPickManager(importManager);

  let disposable = vscode.commands.registerCommand(
    "chunkflow.showPicker",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const snippets = await snippetManager.getRelevantSnippets(
        editor.document
      );
      const quickPick = quickPickManager.createQuickPick(snippets, editor);
      quickPick.show();
    }
  );

  let typeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || event.document !== editor.document) {
      return;
    }

    const changes = event.contentChanges;
    if (changes.length === 0) {
      return;
    }

    const lastChange = changes[changes.length - 1];
    if (lastChange.text === "/") {
      setTimeout(() => {
        vscode.commands.executeCommand("chunkflow.showPicker");
      }, 100);
    }
  });

  context.subscriptions.push(disposable, typeSubscription);
}

export function deactivate() {}
