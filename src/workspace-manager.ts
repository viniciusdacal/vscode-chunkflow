import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { WorkspacePackage } from "./extension.interface";

export class WorkspaceManager {
  private workspacePackages: Map<string, WorkspacePackage> = new Map();
  private rootPath: string | undefined;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    this.rootPath = workspaceFolder.uri.fsPath;
    await this.findWorkspacePackages();
  }

  private async findWorkspacePackages() {
    if (!this.rootPath) {
      return;
    }

    try {
      // Try to read root package.json first
      const rootPackageJson = await this.readPackageJson(this.rootPath);

      if (!rootPackageJson) {
        return;
      }

      // Check for different workspace configurations
      const workspaceGlobs = await this.getWorkspaceGlobs(rootPackageJson);

      if (!workspaceGlobs.length) {
        // Not a monorepo, just add the root package
        this.workspacePackages.set(rootPackageJson.name, {
          ...rootPackageJson,
          path: this.rootPath,
        });
        return;
      }

      // Find all package.json files in workspace
      for (const glob of workspaceGlobs) {
        const packagePaths = await vscode.workspace.findFiles(
          glob + "/package.json"
        );

        for (const packagePath of packagePaths) {
          const packageDir = path.dirname(packagePath.fsPath);
          const packageJson = await this.readPackageJson(packageDir);

          if (packageJson) {
            this.workspacePackages.set(packageJson.name, {
              ...packageJson,
              path: packageDir,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error finding workspace packages:", error);
    }
  }

  private async getWorkspaceGlobs(rootPackageJson: any): Promise<string[]> {
    const globs: string[] = [];

    // Yarn/npm workspaces
    if (Array.isArray(rootPackageJson.workspaces)) {
      globs.push(...rootPackageJson.workspaces);
    } else if (rootPackageJson.workspaces?.packages) {
      globs.push(...rootPackageJson.workspaces.packages);
    }

    // pnpm workspaces
    try {
      const pnpmWorkspacePath = path.join(
        this.rootPath!,
        "pnpm-workspace.yaml"
      );
      const pnpmConfig = await fs.promises.readFile(pnpmWorkspacePath, "utf8");

      // Simple YAML parsing for packages field
      const packagesMatch = pnpmConfig.match(
        /packages:\s*\n((?:\s*-\s*.+\n?)*)/
      );
      if (packagesMatch) {
        const packages = packagesMatch[1]
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("- "))
          .map((line) => line.slice(2));
        globs.push(...packages);
      }
    } catch (error) {
      // No pnpm workspace config found
    }

    return globs;
  }

  private async readPackageJson(dir: string) {
    try {
      const content = await fs.promises.readFile(
        path.join(dir, "package.json"),
        "utf8"
      );
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  getPackagePath(packageName: string): string | undefined {
    return this.workspacePackages.get(packageName)?.path;
  }

  getAllPackages(): WorkspacePackage[] {
    return Array.from(this.workspacePackages.values());
  }
}
