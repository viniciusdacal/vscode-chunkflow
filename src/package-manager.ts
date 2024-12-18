import * as fs from "fs";
import * as path from "path";
import { Snippet } from "./extension.interface";
import { WorkspaceManager } from "./workspace-manager";

export class PackageManager {
  private workspaceManager: WorkspaceManager;

  constructor() {
    this.workspaceManager = new WorkspaceManager();
  }

  async findPackageSnippets(
    workspacePath: string,
    packageName?: string
  ): Promise<{ snippets: Snippet[] } | null> {
    if (packageName) {
      // Check if it's a workspace package first
      const packagePath = this.workspaceManager.getPackagePath(packageName);
      if (packagePath) {
        return this.loadSnippetsFromPath(packagePath);
      }

      // If not a workspace package, check node_modules
      return this.loadSnippetsFromPath(
        path.join(workspacePath, "node_modules", packageName)
      );
    }

    // If no package name provided, check all workspace packages
    const allSnippets: Snippet[] = [];

    // Check root workspace
    const rootSnippets = await this.loadSnippetsFromPath(workspacePath);
    if (rootSnippets) {
      allSnippets.push(...rootSnippets.snippets);
    }

    // Check each workspace package
    const workspacePackages = this.workspaceManager.getAllPackages();
    for (const pkg of workspacePackages) {
      const snippets = await this.loadSnippetsFromPath(pkg.path);
      if (snippets) {
        allSnippets.push(...snippets.snippets);
      }
    }

    return allSnippets.length > 0 ? { snippets: allSnippets } : null;
  }

  private async loadSnippetsFromPath(
    root: string
  ): Promise<{ snippets: Snippet[] } | null> {
    const json = path.join(root, ".chunkflow.config.json");
    const js = path.join(root, ".chunkflow.config.js");

    try {
      // Try JSON first
      try {
        const content = await fs.promises.readFile(json, "utf8");
        if (content) {
          return JSON.parse(content);
        }
      } catch (error) {
        // JSON file doesn't exist or is invalid, continue to JS file
      }

      // Try JS file
      try {
        if (
          await fs.promises
            .access(js)
            .then(() => true)
            .catch(() => false)
        ) {
          const snippets = await import(js);
          return {
            snippets: Array.isArray(snippets.default?.snippets)
              ? snippets.default.snippets
              : snippets.snippets || [],
          };
        }
      } catch (error) {
        console.warn(`Error loading JS snippets from ${js}:`, error);
      }

      // Try package.json snippets field as fallback
      const packageJsonPath = path.join(root, "package.json");
      try {
        const packageJson = JSON.parse(
          await fs.promises.readFile(packageJsonPath, "utf8")
        );
        if (packageJson.snippets) {
          return { snippets: packageJson.snippets };
        }
      } catch (error) {
        // Package.json doesn't exist or has no snippets field
      }

      return null;
    } catch (error) {
      console.error("Error finding package snippets:", error);
      return null;
    }
  }
}
