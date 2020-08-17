function formatSematextLogsOutput (
  context,
  config,
  eventEmitter,
  log,
  callback
) {
  try {
    const parsedLog = parseGithubEvent(log)

    if (config.debug) {
      console.log(parsedLog)
    }

    if (parsedLog) {
      callback(null, parsedLog)
    }
  } catch (e) {
    if (config.debug) {
      console.log(e, log)
    }
    callback(e, log)
  }
}

const initEvent = ({ event, action, webhookName }) => ({
  severity: 'info',
  type: webhookName,
  title: `${capitalize(action)} ${capitalize(parseEventTitle({ event }))}`
})

const initRepoMessage = ({ repoName, repoUrl }) => `${repoName} - ${repoUrl}`

const initAuthorMessage = ({ senderName, senderUrl }) =>
  `${senderName} - ${senderUrl}`

const parseEventTitle = ({ event }) => event.replace(/_/g, ' ')

const parseTextFields = ({ field }) => field.replace(/\+/g, ' ')

const capitalize = s => {
  if (typeof s !== 'string') return ''
  return s.replace(/(?:^|\s)\S/g, a => a.toUpperCase())
}

const parseGithubEvent = log => {
  /**
   * x-github-event" headers that define what data to collect:
   *
   * [x] issues
   * [x] issue_comment
   * [x] pull_request
   * [x] pull_request_review
   * [x] pull_request_review_comment
   * [x] commit_comment
   * [x] push
   * [x] create
   * [x] delete
   * [x] release
   *
   ********************
   */

  const { event, body } = log

  if (event === 'issues' || event === 'issue_comment') {
    return parseIssue(event, body)
  } else if (
    event === 'pull_request' ||
    event === 'pull_request_review' ||
    event === 'pull_request_review_comment'
  ) {
    return parsePullRequest(event, body)
  } else if (event === 'commit_comment') {
    return parseCommitComment(event, body)
  } else if (event === 'push') {
    return parsePush(event, body)
  } else if (event === 'release') {
    return parseRelease(event, body)
  } else if (event === 'create') {
    return parseCreate(event, body)
  } else if (event === 'delete') {
    return parseDelete(event, body)
  } else {
    return null
  }
}

const buildBranchUrl = ({ repoUrl, branchName }) =>
  `${repoUrl}/tree/${branchName}`

const parseRepo = repository => {
  if (!repository) {
    return {}
  }

  return {
    name: repository.full_name,
    url: repository.html_url,
    isPrivate: repository.private,
    isFork: repository.fork,
    defaultBranch: repository.default_branch,
    openIssuesCount: repository.open_issues,
    forksCount: repository.forks,
    starsCount: repository.stargazers_count,
    watchersCount: repository.watchers_count,
    language: repository.language,
    owner: {
      username: repository.owner.login,
      url: repository.owner.html_url
    },
    homepage: repository.homepage,
    createdAt:
      typeof repository.created_at === 'number'
        ? new Date(repository.created_at * 1000)
        : repository.created_at,
    updatedAt:
      typeof repository.updated_at === 'number'
        ? new Date(repository.updated_at * 1000)
        : repository.updated_at,
    pushedAt:
      typeof repository.pushed_at === 'number'
        ? new Date(repository.pushed_at * 1000)
        : repository.pushed_at
  }
}

const parseSender = sender => {
  if (!sender) {
    return {}
  }

  return {
    url: sender.html_url,
    username: sender.login,
    avatarUrl: sender.avatar_url,
    type: sender.type,
    siteAdmin: sender.siteAdmin
  }
}

const parseIssue = (event, body) => {
  const { action, repository, sender, issue } = body
  if (!issue) {
    return
  }

  const parsedRepo = parseRepo(repository)
  const parsedSender = parseSender(sender)

  const parsedIssue = {
    url: issue.html_url,
    number: issue.number,
    title: parseTextFields({ field: issue.title }),
    body: parseTextFields({ field: issue.body }),
    state: issue.state,
    commentCount: issue.comments,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at
  }

  if (issue.assignee) {
    parsedIssue.assignee = {
      url: issue.assignee.html_url,
      username: issue.assignee.login,
      avatarUrl: issue.assignee.avatar_url,
      type: issue.assignee.type,
      siteAdmin: issue.assignee.siteAdmin
    }
  }

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    event,
    action,
    repository: parsedRepo,
    sender: parsedSender,
    issue: parsedIssue,
    message: `${initRepoMessage({
      repoName: parsedRepo.name,
      repoUrl: parsedRepo.url
    })} | ${event} #${parsedIssue.number} - ${
      parsedIssue.url
    } ${action} by ${initAuthorMessage({
      senderUrl: parsedSender.url,
      senderName: parsedSender.username
    })}`
  }
}

const parsePullRequest = (event, body) => {
  const { action, repository, sender, pull_request: pullRequest } = body
  if (!pullRequest) {
    return
  }

  const parsedRepo = parseRepo(repository)
  const parsedSender = parseSender(sender)

  const parsedPullRequest = {
    url: pullRequest.html_url,
    number: pullRequest.number,
    title: parseTextFields({ field: pullRequest.title }),
    body: parseTextFields({ field: pullRequest.body }),
    state: pullRequest.state,
    commentCount: pullRequest.comments,
    createdAt: pullRequest.created_at,
    updatedAt: pullRequest.updated_at,
    closedAt: pullRequest.closed_at
  }

  if (pullRequest.assignee) {
    parsedPullRequest.assignee = {
      url: pullRequest.assignee.html_url,
      username: pullRequest.assignee.login,
      avatarUrl: pullRequest.assignee.avatar_url,
      type: pullRequest.assignee.type,
      siteAdmin: pullRequest.assignee.siteAdmin
    }
  }

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    event,
    action,
    repository: parsedRepo,
    sender: parsedSender,
    pullRequest: parsedPullRequest,
    message: `${initRepoMessage({
      repoName: parsedRepo.name,
      repoUrl: parsedRepo.url
    })} | ${event} #${parsedPullRequest.number} - ${
      parsedPullRequest.url
    } ${action} by ${initAuthorMessage({
      senderUrl: parsedSender.url,
      senderName: parsedSender.username
    })}`
  }
}

const parseCommitComment = (event, body) => {
  const { action, repository, sender, comment } = body
  if (!comment) {
    return
  }

  const parsedRepo = parseRepo(repository)
  const parsedSender = parseSender(sender)

  const parsedComment = {
    commitId: comment.commit_id,
    url: comment.html_url,
    body: parseTextFields({ field: comment.body }),
    line: comment.line,
    path: comment.path,
    position: comment.position,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    authorAssociation: comment.author_association
  }

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    message: `${initRepoMessage({
      repoName: parsedRepo.name,
      repoUrl: parsedRepo.url
    })} - ${event} ${parsedComment.commitId} - ${
      parsedComment.url
    } ${action} by ${initAuthorMessage({
      senderUrl: parsedSender.url,
      senderName: parsedSender.username
    })}`,
    event,
    action,
    repository: parsedRepo,
    sender: parsedSender,
    comment: parsedComment
  }
}

const parsePush = (event, body) => {
  const { ref, commits, head_commit: headCommit, repository, sender } = body
  const commitCount = commits && commits.length
  if (!commitCount) {
    return
  }

  const { 1: refType, 2: branchName } = ref.split('/')
  if (refType !== 'heads') {
    return
  }

  const action = 'Branch'
  const parsedRepo = parseRepo(repository)
  const parsedSender = parseSender(sender)
  const parsedBranch = {
    name: branchName,
    url: buildBranchUrl({ repoUrl: parsedRepo.url, branchName })
  }

  const parsedHeadCommit = {
    id: headCommit.id,
    treeId: headCommit.tree_id,
    distinct: headCommit.distinct,
    body: parseTextFields({ field: headCommit.message }),
    timestamp: headCommit.timestamp,
    url: headCommit.url,
    author: {
      username: headCommit.author.username
    },
    committer: {
      username: headCommit.committer.username
    },
    added: headCommit.added,
    removed: headCommit.removed,
    modified: headCommit.modified
  }

  const reducedCommits = commits.reduce((acc, curr) => {
    const {
      id,
      tree_id: treeId,
      distinct,
      message: body,
      timestamp,
      url,
      author: { username: authorUsername },
      committer: { username: committerUsername },
      added,
      removed,
      modified
    } = curr

    const currCommit = {
      id,
      treeId,
      distinct,
      body: parseTextFields({ field: body }),
      timestamp,
      url,
      author: { username: authorUsername },
      committer: { username: committerUsername },
      added,
      removed,
      modified
    }

    acc.push(currCommit)
    return acc
  }, [])

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    message: `${initRepoMessage({
      repoName: parsedRepo.name,
      repoUrl: parsedRepo.url
    })} ${commitCount} commit(s) - ${(headCommit && headCommit.url) ||
      parsedRepo.url} pushed to branch: ${parsedBranch.name} - ${
      parsedBranch.url
    }) by ${initAuthorMessage({
      senderUrl: parsedSender.url,
      senderName: parsedSender.username
    })}`,
    event,
    action,
    branch: parsedBranch,
    repository: parsedRepo,
    sender: parsedSender,
    headCommit: parsedHeadCommit,
    commitCount,
    commits: reducedCommits
  }
}

const parseRelease = (event, body) => {
  const { action, repository, sender, release } = body
  if (!release) {
    return
  }

  const parsedRepo = parseRepo(repository)
  const parsedSender = parseSender(sender)

  const {
    html_url: url,
    tag_name: tag,
    name,
    body: releaseBody,
    target_commitish: branch,
    draft,
    author: { login: authorUsername },
    prerelease,
    created_at: createdAt,
    published_at: publishedAt,
    assets,
    tarball_url: tarballUrl,
    zipball_url: zipballUrl
  } = release

  const parsedRelease = {
    url,
    tag,
    name: parseTextFields({ field: name }),
    body: parseTextFields({ field: releaseBody }),
    branch,
    draft,
    author: { username: authorUsername },
    prerelease,
    createdAt,
    publishedAt,
    assets,
    tarballUrl,
    zipballUrl
  }

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    message: `${initRepoMessage({
      repoName: parsedRepo.name,
      repoUrl: parsedRepo.url
    })} ${event} ${parsedRelease.tag} - ${
      parsedRelease.url
    } ${action} by ${initAuthorMessage({
      senderUrl: parsedSender.url,
      senderName: parsedSender.username
    })}`,
    event,
    action,
    repository: parsedRepo,
    sender: parsedSender,
    release: parsedRelease
  }
}

const parseCreate = (event, body) => {
  const { repository, sender, ref: branchName, ref_type: refType } = body
  if (refType !== 'branch') {
    return
  }

  const action = 'Branch'
  const parsedRepo = parseRepo(repository)
  const parsedSender = parseSender(sender)
  const parsedBranch = {
    name: branchName,
    url: buildBranchUrl({ repoUrl: parsedRepo.url, branchName })
  }

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    message: `${initRepoMessage({
      repoName: parsedRepo.name,
      repoUrl: parsedRepo.url
    })} Branch ${parsedBranch.name} - ${
      parsedBranch.url
    }) created by ${initAuthorMessage({
      senderUrl: parsedSender.url,
      senderName: parsedSender.username
    })}`,
    event,
    action,
    repository: parsedRepo,
    sender: parsedSender,
    branch: parsedBranch
  }
}

const parseDelete = (event, body) => {
  const { repository, sender, ref: branchName, ref_type: refType } = body
  if (refType !== 'branch') {
    return
  }

  const action = 'Branch'
  const parsedRepo = parseRepo(repository)
  const parsedSender = parseSender(sender)
  const parsedBranch = {
    name: branchName,
    url: buildBranchUrl({ repoUrl: parsedRepo.url, branchName })
  }

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    message: `${initRepoMessage({
      repoName: parsedRepo.name,
      repoUrl: parsedRepo.url
    })} Branch ${parsedBranch.name} - ${
      parsedBranch.url
    }) deleted by ${initAuthorMessage({
      senderUrl: parsedSender.url,
      senderName: parsedSender.username
    })}`,
    event,
    action,
    repository: parsedRepo,
    sender: parsedSender,
    branch: parsedBranch
  }
}

module.exports = formatSematextLogsOutput
