import {
  startCursorAgent,
  openCursor,
  prepareWorkspace,
} from "./workspace.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

const clonePath = argument("--clone");
const workspaceRoot = argument("--workspace-root");
const branch = argument("--branch");
if (!clonePath || !workspaceRoot || !branch) {
  throw new Error(
    "Использование: node sdlc/scripts/workspace-agent.mjs --clone <git-clone> --workspace-root <dir> --branch <stage-branch> [--open] [--run-agent]"
  );
}

const workspace = prepareWorkspace({ clonePath, workspaceRoot, branch });
if (process.argv.includes("--open") && workspace.created)
  openCursor(workspace.target);

let agent = null;
if (process.argv.includes("--run-agent") && workspace.created) {
  agent = startCursorAgent({
    target: workspace.target,
    agentCommand:
      argument("--agent-command") ??
      process.env.CURSOR_AGENT_COMMAND ??
      "cursor-agent",
    unattended: process.argv.includes("--unattended"),
  });
}

console.log(JSON.stringify({ ...workspace, agent }, null, 2));
