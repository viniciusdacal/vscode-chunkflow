import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/types";
import { parse } from "@typescript-eslint/typescript-estree";
import * as vscode from "vscode";
import { RequiredImport } from "./extension.interface";

export class ImportManager {
  private findExistingImport(
    importDeclarations: TSESTree.ImportDeclaration[],
    packageName: string
  ): TSESTree.ImportDeclaration | undefined {
    return importDeclarations.find((decl) => decl.source.value === packageName);
  }

  private async parseFileImports(document: vscode.TextDocument) {
    const text = document.getText();
    try {
      const ast = parse(text, {
        range: true,
        loc: true,
      });

      return ast.body.filter(
        (node): node is TSESTree.ImportDeclaration =>
          node.type === AST_NODE_TYPES.ImportDeclaration
      );
    } catch (error) {
      console.error("Error parsing file:", error);
      return [];
    }
  }

  private createImportStatement(requiredImport: RequiredImport): string {
    const { packageName, defaultImport, namedExports, importNamespace } =
      requiredImport;

    const parts: string[] = [];

    if (importNamespace) {
      return `import * as ${importNamespace} from '${packageName}';\n`;
    }

    if (defaultImport) {
      parts.push(defaultImport);
    }

    if (namedExports?.length) {
      const namedImports = namedExports.join(", ");
      if (parts.length) {
        parts.push(`{ ${namedImports} }`);
      } else {
        parts.push(`{ ${namedImports} }`);
      }
    }

    if (parts.length === 0) {
      return `import '${packageName}';\n`;
    }

    return `import ${parts.join(", ")} from '${packageName}';\n`;
  }

  private modifyExistingImport(
    existingImport: TSESTree.ImportDeclaration,
    requiredImport: RequiredImport
  ): string | null {
    const specifiers = existingImport.specifiers;
    let needsModification = false;

    // Collect existing imports
    const existingDefault = specifiers.find(
      (s): s is TSESTree.ImportDefaultSpecifier =>
        s.type === AST_NODE_TYPES.ImportDefaultSpecifier
    )?.local.name;

    const existingNamed = specifiers
      .filter(
        (s): s is TSESTree.ImportSpecifier =>
          s.type === AST_NODE_TYPES.ImportSpecifier
      )
      .map((s) => (s.imported as any).name);

    // Check if we need to add a default import
    const needsDefault =
      requiredImport.defaultImport &&
      requiredImport.defaultImport !== existingDefault;

    // Check which named exports need to be added
    const newNamedExports =
      requiredImport.namedExports?.filter(
        (name) => !existingNamed.includes(name)
      ) ?? [];

    if (!needsDefault && newNamedExports.length === 0) {
      return null; // No modifications needed
    }

    // Build new import statement
    const parts: string[] = [];

    if (needsDefault) {
      parts.push(requiredImport.defaultImport!);
    } else if (existingDefault) {
      parts.push(existingDefault);
    }

    const allNamedExports = [...existingNamed, ...newNamedExports];
    if (allNamedExports.length > 0) {
      if (parts.length) {
        parts.push(`{ ${allNamedExports.join(", ")} }`);
      } else {
        parts.push(`{ ${allNamedExports.join(", ")} }`);
      }
    }

    return `import ${parts.join(", ")} from '${requiredImport.packageName}';\n`;
  }

  async addImportsIfNeeded(
    editor: vscode.TextEditor,
    requiredImports: RequiredImport[]
  ): Promise<void> {
    const document = editor.document;
    const importDeclarations = await this.parseFileImports(document);
    const edit = new vscode.WorkspaceEdit();

    for (const requiredImport of requiredImports) {
      const existingImport = this.findExistingImport(
        importDeclarations,
        requiredImport.packageName
      );

      if (existingImport) {
        const modifiedImport = this.modifyExistingImport(
          existingImport,
          requiredImport
        );
        if (modifiedImport) {
          const start = document.positionAt(existingImport.range[0]);
          const end = document.positionAt(existingImport.range[1]);
          edit.replace(
            document.uri,
            new vscode.Range(start, end),
            modifiedImport
          );
        }
      } else {
        const importStatement = this.createImportStatement(requiredImport);
        const position = this.findImportPosition(document, importDeclarations);
        edit.insert(document.uri, position, importStatement);
      }
    }

    if (edit.size > 0) {
      await vscode.workspace.applyEdit(edit);
    }
  }

  private findImportPosition(
    document: vscode.TextDocument,
    importDeclarations: TSESTree.ImportDeclaration[]
  ): vscode.Position {
    if (importDeclarations.length === 0) {
      return new vscode.Position(0, 0);
    }

    const lastImport = importDeclarations[importDeclarations.length - 1];
    return document.positionAt(lastImport.range[1]).translate(1, 0);
  }
}
