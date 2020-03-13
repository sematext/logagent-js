function formatSematextLogsOutput (context, config, eventEmitter, log, callback) {
  try {
    const parsedLog = parseGithubEvent(log)
    if (parsedLog) { callback(null, parsedLog) }
  } catch (e) {
    callback(e, log)
  }
}

const initEvent = ({ event, action, webhookName }) => ({
  severity: 'info',
  type: webhookName,
  title: `${capitalize(action)} ${capitalize(parseEventTitle({ event }))}`
})

const initRepoMessage = ({ repoName, repoUrl }) =>
  `${repoName} - ${repoUrl}`

const initAuthorMessage = ({ senderName, senderUrl }) =>
  `${senderName} - ${senderUrl}`

const parseEventTitle = ({ event }) => event.replace(/_/g, ' ')

const capitalize = (s) => {
  if (typeof s !== 'string') return ''
  return s.replace(/(?:^|\s)\S/g, (a) => a.toUpperCase())
}

const parseGithubEvent = (log) => {
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

  if (event === 'issues' ||
    event === 'issue_comment') {
    return parseIssue(event, body)
  } else if (event === 'pull_request' ||
    event === 'pull_request_review' ||
    event === 'pull_request_review_comment') {
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

const buildBranchUrl = ({ repoUrl, branchName }) => `${repoUrl}/tree/${branchName}`

const parseRepo = (repository) => {
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
    createdAt: repository.created_at,
    updatedAt: repository.updated_at,
    pushedAt: repository.pushed_at
  }
}

const parseSender = (sender) => {
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
  const {
    action,
    repository,
    sender,
    issue
  } = body
  if (!issue) {
    return
  }

  const parsedRepo = parseRepo(repository)
  const parsedSender = parseSender(sender)

  const parsedIssue = {
    url: issue.html_url,
    number: issue.number,
    title: issue.title,
    body: issue.body,
    state: issue.state,
    assignee: {
      url: issue.assignee.html_url,
      username: issue.assignee.login,
      avatarUrl: issue.assignee.avatar_url,
      type: issue.assignee.type,
      siteAdmin: issue.assignee.siteAdmin
    },
    commentCount: issue.comments,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    closedAt: issue.closed_at
  }

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    event,
    action,
    repository: parsedRepo,
    sender: parsedSender,
    issue: parsedIssue,
    message: `${initRepoMessage({ repoName: parsedRepo.name, repoUrl: parsedRepo.url })} | ${event} #${parsedIssue.number} - ${parsedIssue.url} ${action} by ${initAuthorMessage({ senderUrl: parsedSender.url, senderName: parsedSender.username })}`
  }
}

const parsePullRequest = (event, body) => {
  const {
    action,
    repository,
    sender,
    pull_request: pullRequest
  } = body
  if (!pullRequest) {
    return
  }

  const parsedRepo = parseRepo(repository)
  const parsedSender = parseSender(sender)

  const parsedPullRequest = {
    url: pullRequest.html_url,
    number: pullRequest.number,
    title: pullRequest.title,
    body: pullRequest.body,
    state: pullRequest.state,
    assignee: {
      url: pullRequest.assignee.html_url,
      username: pullRequest.assignee.login,
      avatarUrl: pullRequest.assignee.avatar_url,
      type: pullRequest.assignee.type,
      siteAdmin: pullRequest.assignee.siteAdmin
    },
    commentCount: pullRequest.comments,
    createdAt: pullRequest.created_at,
    updatedAt: pullRequest.updated_at,
    closedAt: pullRequest.closed_at
  }

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    event,
    action,
    repository: parsedRepo,
    sender: parsedSender,
    pullRequest: parsedPullRequest,
    message: `${initRepoMessage({ repoName: parsedRepo.name, repoUrl: parsedRepo.url })} | ${event} #${parsedPullRequest.number} - ${parsedPullRequest.url} ${action} by ${initAuthorMessage({ senderUrl: parsedSender.url, senderName: parsedSender.username })}`
  }
}

const parseCommitComment = (event, body) => {
  const {
    action,
    repository,
    sender,
    comment
  } = body
  if (!comment) {
    return
  }

  const parsedRepo = parseRepo(repository)
  const parsedSender = parseSender(sender)

  const parsedComment = {
    commitId: comment.commit_id,
    url: comment.html_url,
    body: comment.body,
    line: comment.line,
    path: comment.path,
    position: comment.position,
    createdAt: comment.created_at,
    updatedAt: comment.updated_at,
    authorAssociation: comment.author_association
  }

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    message: `${initRepoMessage({ repoName: parsedRepo.name, repoUrl: parsedRepo.url })} - ${event} ${parsedComment.id} - ${parsedComment.url} ${action} by ${initAuthorMessage({ senderUrl: parsedSender.url, senderName: parsedSender.username })}`,
    event,
    action,
    repository: parsedRepo,
    sender: parsedSender,
    comment: parsedComment
  }
}

const parsePush = (event, body) => {
  const {
    ref,
    commits,
    head_commit: headCommit,
    repository,
    sender
  } = body
  const commitCount = commits && commits.length
  if (!commitCount) {
    return
  }

  const {
    1: refType,
    2: branchName
  } = ref.split('/')
  if (refType !== 'heads') {
    return
  }

  const {
    repoName,
    repoUrl
  } = parseRepo(repository)
  const {
    senderUrl,
    senderName,
    senderAvatarUrl
  } = parseSender(sender)

  const branchUrl = buildBranchUrl({ repoUrl, branchName })

  return {
    ...initEvent({ event, action: 'branch', webhookName: 'GitHub' }),
    message: `${initRepoMessage({ repoName, repoUrl })}\n[${commitCount} commit(s)](${(headCommit && headCommit.url) || repoUrl}) pushed to branch [${branchName}](${branchUrl}) by ${initAuthorMessage({ senderUrl, senderName, senderAvatarUrl })}`,
    event,
    branchName,
    branchUrl,
    commitCount,
    repository,
    sender,
    headCommit
  }
}

const parseRelease = (event, body) => {
  const {
    action,
    repository,
    sender,
    release
  } = body
  if (!release) {
    return
  }

  const {
    repoName,
    repoUrl
  } = parseRepo(repository)
  const {
    senderUrl,
    senderName,
    senderAvatarUrl
  } = parseSender(sender)

  const {
    html_url: url,
    tag_name: tag
  } = release

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    message: `${initRepoMessage({ repoName, repoUrl })}\n[${event} (${tag})](${url}) ${action} by ${initAuthorMessage({ senderUrl, senderName, senderAvatarUrl })}`,
    event,
    action,
    repository,
    sender,
    release
  }
}

const parseCreate = (event, body) => {
  const {
    repository,
    sender,
    ref: branchName,
    ref_type: refType
  } = body
  if (refType !== 'branch') {
    return
  }

  const {
    repoName,
    repoUrl
  } = parseRepo(repository)
  const {
    senderUrl,
    senderName,
    senderAvatarUrl
  } = parseSender(sender)

  const branchUrl = buildBranchUrl({ repoUrl, branchName })

  return {
    ...initEvent({ event, action: 'Branch', webhookName: 'GitHub' }),
    message: `${initRepoMessage({ repoName, repoUrl })}\nBranch [${branchName}](${branchUrl}) created by ${initAuthorMessage({ senderUrl, senderName, senderAvatarUrl })}`,
    event,
    repository,
    sender,
    branchName,
    branchUrl
  }
}

const parseDelete = (event, body) => {
  const {
    repository,
    sender,
    ref: branchName,
    ref_type: refType
  } = body
  if (refType !== 'branch') {
    return
  }

  const {
    repoName,
    repoUrl
  } = parseRepo(repository)
  const {
    senderUrl,
    senderName,
    senderAvatarUrl
  } = parseSender(sender)

  const branchUrl = buildBranchUrl({ repoUrl, branchName })

  return {
    ...initEvent({ event, action: 'Branch', webhookName: 'GitHub' }),
    message: `${initRepoMessage({ repoName, repoUrl })}\nBranch [${branchName}](${branchUrl}) deleted by ${initAuthorMessage({ senderUrl, senderName, senderAvatarUrl })}`,
    event,
    repository,
    sender,
    branchName,
    branchUrl
  }
}

module.exports = formatSematextLogsOutput
