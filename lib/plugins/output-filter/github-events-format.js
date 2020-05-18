function formatSematextEventsOutput (
  context,
  config,
  eventEmitter,
  log,
  callback
) {
  try {
    const parsedLog = parseGithubEvent(log)
    if (parsedLog) {
      callback(null, parsedLog)
    }
  } catch (e) {
    callback(e, log)
  }
}

const initEvent = ({ event, action, webhookName }) => ({
  severity: 'info',
  type: webhookName,
  title: `${webhookName} | ${capitalize(event)} ${capitalize(action)}`
})

const initRepoMessage = ({ repoName, repoUrl }) => `[[${repoName}](${repoUrl})]`

const initAuthorMessage = ({ senderAvatarUrl, senderName, senderUrl }) =>
  `![](${senderAvatarUrl}&s=25) [${senderName}](${senderUrl})`

const capitalize = s => {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
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

  if (
    event === 'issues' ||
    event === 'issue_comment' ||
    event === 'pull_request' ||
    event === 'pull_request_review' ||
    event === 'pull_request_review_comment'
  ) {
    return parseIssueOrPullRequest(event, body)
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
    repoName: repository.full_name,
    repoUrl: repository.html_url
  }
}

const parseSender = sender => {
  if (!sender) {
    return {}
  }

  return {
    senderUrl: sender.html_url,
    senderName: sender.login,
    senderAvatarUrl: sender.avatar_url
  }
}

const parseIssueOrPullRequest = (event, body) => {
  const { action, repository, sender, pull_request: pullRequest, issue } = body
  if (!(issue || pullRequest)) {
    return
  }

  const { repoName, repoUrl } = parseRepo(repository)
  const { senderUrl, senderName, senderAvatarUrl } = parseSender(sender)

  const prUrl = pullRequest && pullRequest.html_url
  const prNumber = pullRequest && pullRequest.number

  const issueUrl = issue && issue.html_url
  const issueNumber = issue && issue.number

  const eventUrl = prUrl || issueUrl
  const number = prNumber || issueNumber || null

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    message: `#### ${initRepoMessage({
      repoName,
      repoUrl
    })}\n[${event} #${number}](${eventUrl}) ${action} by ${initAuthorMessage({
      senderUrl,
      senderName,
      senderAvatarUrl
    })}\n`
  }
}

const parseCommitComment = (event, body) => {
  const { action, repository, sender, comment } = body
  if (!comment) {
    return
  }

  const { repoName, repoUrl } = parseRepo(repository)
  const { senderUrl, senderName, senderAvatarUrl } = parseSender(sender)

  const commit = {
    id: comment.commit_id,
    url: comment.html_url,
    message: comment.body
  }

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    message: `#### ${initRepoMessage({ repoName, repoUrl })}\n[${event} (${
      commit.id
    })](${commit.url}) ${action} by ${initAuthorMessage({
      senderUrl,
      senderName,
      senderAvatarUrl
    })}\n`
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

  const { repoName, repoUrl } = parseRepo(repository)
  const { senderUrl, senderName, senderAvatarUrl } = parseSender(sender)

  const branchUrl = buildBranchUrl({ repoUrl, branchName })

  return {
    ...initEvent({ event, action: 'branch', webhookName: 'GitHub' }),
    message: `#### ${initRepoMessage({
      repoName,
      repoUrl
    })}\n[${commitCount} commit(s)](${(headCommit && headCommit.url) ||
      repoUrl}) pushed to branch [${branchName}](${branchUrl}) by ${initAuthorMessage(
      { senderUrl, senderName, senderAvatarUrl }
    )}\n`
  }
}

const parseRelease = (event, body) => {
  const { action, repository, sender, release } = body
  if (!release) {
    return
  }

  const { repoName, repoUrl } = parseRepo(repository)
  const { senderUrl, senderName, senderAvatarUrl } = parseSender(sender)

  const { html_url: url, tag_name: tag } = release

  return {
    ...initEvent({ event, action, webhookName: 'GitHub' }),
    message: `#### ${initRepoMessage({
      repoName,
      repoUrl
    })}\n[${event} (${tag})](${url}) ${action} by ${initAuthorMessage({
      senderUrl,
      senderName,
      senderAvatarUrl
    })}\n`
  }
}

const parseCreate = (event, body) => {
  const { repository, sender, ref: branchName, ref_type: refType } = body
  if (refType !== 'branch') {
    return
  }

  const { repoName, repoUrl } = parseRepo(repository)
  const { senderUrl, senderName, senderAvatarUrl } = parseSender(sender)

  const branchUrl = buildBranchUrl({ repoUrl, branchName })

  return {
    ...initEvent({ event, action: 'Branch', webhookName: 'GitHub' }),
    message: `#### ${initRepoMessage({
      repoName,
      repoUrl
    })}\nBranch [${branchName}](${branchUrl}) created by ${initAuthorMessage({
      senderUrl,
      senderName,
      senderAvatarUrl
    })}\n`
  }
}

const parseDelete = (event, body) => {
  const { repository, sender, ref: branchName, ref_type: refType } = body
  if (refType !== 'branch') {
    return
  }

  const { repoName, repoUrl } = parseRepo(repository)
  const { senderUrl, senderName, senderAvatarUrl } = parseSender(sender)

  const branchUrl = buildBranchUrl({ repoUrl, branchName })

  return {
    ...initEvent({ event, action: 'Branch', webhookName: 'GitHub' }),
    message: `#### ${initRepoMessage({
      repoName,
      repoUrl
    })}\nBranch [${branchName}](${branchUrl}) deleted by ${initAuthorMessage({
      senderUrl,
      senderName,
      senderAvatarUrl
    })}\n`
  }
}

module.exports = formatSematextEventsOutput
