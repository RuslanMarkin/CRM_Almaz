import {
  openCursor,
  prepareWorkspace,
  startCursorAgent,
} from "./workspace.mjs";
import { parseWorkspaceTask } from "./workspace-task.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

const repository = argument("--repository");
const login = argument("--login");
const clonePath = argument("--clone");
const workspaceRoot = argument("--workspace-root");
if (!repository || !login || !clonePath || !workspaceRoot) {
  throw new Error(
    "Использование: node sdlc/scripts/workspace-dispatcher.mjs --repository owner/repo --login github-login --clone <git-clone> --workspace-root <dir> [--once] [--open] [--run-agent]"
  );
}
if (!/^[^/\s]+\/[^/\s]+$/.test(repository))
  throw new Error("repository должен иметь формат owner/repo.");

const token = process.env.GITHUB_TOKEN;
if (!token)
  throw new Error(
    "Для workspace-dispatcher задайте GITHUB_TOKEN с доступом только к нужному репозиторию."
  );
const [owner, repo] = repository.split("/");
const open = process.argv.includes("--open");
const runAgent = process.argv.includes("--run-agent");
const unattended = process.argv.includes("--unattended");
const once = process.argv.includes("--once");
const pollSeconds = Number(argument("--poll-seconds") ?? "30");
if (!Number.isFinite(pollSeconds) || pollSeconds < 10) {
  throw new Error("--poll-seconds должен быть числом не меньше 10.");
}

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(
      `GitHub API ${options.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`
    );
  }
  return response.status === 204 ? null : response.json();
}

async function isClaimed(issue, task) {
  const comments = await github(
    `/repos/${owner}/${repo}/issues/${issue.number}/comments?per_page=100`
  );
  const marker = `<!-- sdlc-workspace-claimed:${task.branch} -->`;
  return comments.some(comment => comment.body?.includes(marker));
}

async function processTasks() {
  const issues = await github(
    `/repos/${owner}/${repo}/issues?state=open&assignee=${encodeURIComponent(login)}&per_page=100`
  );
  for (const issue of issues) {
    if (issue.pull_request) continue;
    const task = parseWorkspaceTask(issue.body);
    if (!task || (await isClaimed(issue, task))) continue;

    try {
      const workspace = prepareWorkspace({
        clonePath,
        workspaceRoot,
        branch: task.branch,
      });
      let agent = null;
      if (workspace.created && open) openCursor(workspace.target);
      if (workspace.created && runAgent) {
        agent = startCursorAgent({
          target: workspace.target,
          agentCommand:
            argument("--agent-command") ??
            process.env.CURSOR_AGENT_COMMAND ??
            "cursor-agent",
          unattended,
        });
      }
      await github(`/repos/${owner}/${repo}/issues/${issue.number}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: `<!-- sdlc-workspace-claimed:${task.branch} -->\nWorkspace подготовлен: \`${workspace.target}\`${agent ? `; Cursor Agent PID ${agent.pid}, log: \`${agent.logPath}\`` : ""}.`,
        }),
      });
      console.log(`Получена задача ${task.branch}: ${workspace.target}`);
    } catch (error) {
      console.error(
        `Не удалось подготовить workspace для Issue #${issue.number}: ${error.message}`
      );
    }
  }
}

do {
  try {
    await processTasks();
  } catch (error) {
    console.error(`Ошибка опроса GitHub: ${error.message}`);
    if (once) {
      process.exitCode = 1;
      break;
    }
  }
  if (!once) await sleep(pollSeconds * 1_000);
} while (!once);
