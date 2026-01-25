import { Octokit } from "@octokit/rest";

export interface GitHubCommitOptions {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  content: string;
  message: string;
  accessToken: string;
}

export interface GitHubPROptions {
  owner: string;
  repo: string;
  head: string;
  base: string;
  title: string;
  body: string;
  accessToken: string;
}

/**
 * Creates or updates a file in a GitHub repository
 */
export async function createOrUpdateFile({
  owner,
  repo,
  branch,
  filePath,
  content,
  message,
  accessToken,
}: GitHubCommitOptions): Promise<{ sha: string; commitSha: string }> {
  const octokit = new Octokit({
    auth: accessToken,
  });

  try {
    // Get the current commit SHA of the branch
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });

    const commitSha = refData.object.sha;

    // Create a blob for the file content
    const { data: blobData } = await octokit.git.createBlob({
      owner,
      repo,
      content: Buffer.from(content).toString("base64"),
      encoding: "base64",
    });

    // Get the current tree
    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: commitSha,
    });

    // Create a new tree
    const { data: treeData } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: commitData.tree.sha,
      tree: [
        {
          path: filePath,
          mode: "100644",
          type: "blob",
          sha: blobData.sha,
        },
      ],
    });

    // Create a new commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message,
      tree: treeData.sha,
      parents: [commitSha],
    });

    // Update the reference
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return {
      sha: blobData.sha,
      commitSha: newCommit.sha,
    };
  } catch (error) {
    console.error("Error creating/updating file:", error);
    throw new Error("Failed to create or update file in GitHub");
  }
}

/**
 * Creates a pull request
 */
export async function createPullRequest({
  owner,
  repo,
  head,
  base,
  title,
  body,
  accessToken,
}: GitHubPROptions): Promise<{ number: number; url: string }> {
  const octokit = new Octokit({
    auth: accessToken,
  });

  try {
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      head,
      base,
      title,
      body,
    });

    return {
      number: pr.number,
      url: pr.html_url,
    };
  } catch (error) {
    console.error("Error creating pull request:", error);
    throw new Error("Failed to create pull request");
  }
}

/**
 * Creates a new branch
 */
export async function createBranch({
  owner,
  repo,
  branchName,
  accessToken,
}: {
  owner: string;
  repo: string;
  branchName: string;
  accessToken: string;
}): Promise<void> {
  const octokit = new Octokit({
    auth: accessToken,
  });

  try {
    // First, try to get the default branch from the repository
    const { data: repoData } = await octokit.repos.get({
      owner,
      repo,
    });

    const defaultBranch = repoData.default_branch || "main";

    // Get the current commit SHA of the default branch
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });

    // Create a new branch
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: refData.object.sha,
    });
  } catch (error: any) {
    console.error("Error creating branch:", error);
    const errorMsg = error?.message || error?.response?.data?.message || "Unknown error";
    throw new Error(`Failed to create branch: ${errorMsg}`);
  }
}

/**
 * Generates a unique branch name based on timestamp
 */
export function generateBranchName(prefix: string = "markdly"): string {
  const timestamp = Date.now();
  return `${prefix}-${timestamp}`;
}

/**
 * Creates a complete workflow: branch → commit → PR
 */
export async function createGitHubWorkflow({
  owner,
  repo,
  filePath,
  content,
  message,
  title,
  body,
  accessToken,
}: {
  owner: string;
  repo: string;
  filePath: string;
  content: string;
  message: string;
  title: string;
  body: string;
  accessToken: string;
}): Promise<{ prNumber: number; prUrl: string; commitSha: string }> {
  const octokit = new Octokit({
    auth: accessToken,
  });

  // Get the default branch from the repository
  const { data: repoData } = await octokit.repos.get({
    owner,
    repo,
  });

  const defaultBranch = repoData.default_branch || "main";
  const branchName = generateBranchName();

  // Create branch
  await createBranch({
    owner,
    repo,
    branchName,
    accessToken,
  });

  // Create/Update file
  const { commitSha } = await createOrUpdateFile({
    owner,
    repo,
    branch: branchName,
    filePath,
    content,
    message,
    accessToken,
  });

  // Create PR
  const pr = await createPullRequest({
    owner,
    repo,
    head: branchName,
    base: defaultBranch,
    title,
    body,
    accessToken,
  });

  return {
    prNumber: pr.number,
    prUrl: pr.url,
    commitSha,
  };
}

/**
 * Validates repository access
 */
export async function validateRepoAccess(
  owner: string,
  repo: string,
  accessToken: string
): Promise<boolean> {
  const octokit = new Octokit({
    auth: accessToken,
  });

  try {
    await octokit.repos.get({
      owner,
      repo,
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Lists repositories accessible to the authenticated user
 */
export async function listGitHubRepos(accessToken: string): Promise<Array<{ name: string; owner: { login: string } }>> {
  const octokit = new Octokit({
    auth: accessToken,
  });

  try {
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: "updated",
    });

    return repos.map((repo) => ({
      name: repo.name,
      owner: { login: repo.owner.login },
    }));
  } catch (error) {
    console.error("Error listing GitHub repos:", error);
    throw new Error("Failed to list GitHub repositories");
  }
}
