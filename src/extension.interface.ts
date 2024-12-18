export interface RequiredImport {
  packageName: string;
  // For importing multiple named exports
  namedExports?: string[];
  // For default import, specify the name
  defaultImport?: string;
  // For cases where we need the entire namespace
  importNamespace?: string;
}

export interface Snippet {
  label: string;
  description: string;
  body: string;
  scope: string;
  package: string;
  requiredImports?: RequiredImport[];
}

export interface WorkspacePackage {
  name: string;
  version: string;
  path: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
