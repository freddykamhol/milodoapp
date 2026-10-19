export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { createRequire } = process.getBuiltinModule("module")!;
  const requireFromProject = createRequire(`${process.cwd()}/package.json`);
  requireFromProject("tsx/cjs");
  const { initializeNodeRuntime } = requireFromProject("./src/instrumentation-node.ts") as {
    initializeNodeRuntime: () => Promise<void>;
  };
  await initializeNodeRuntime();
}
