const asyncMiddleware = require('../middleware/asyncMiddleware')
const router = require('express').Router()
const gitLabApi = require('../lib/gitlab.js')
const config = require('painless-config')

let logger = require('../providers/logging/logger')()

function gitLabClient() {
  return gitLabApi.getClient(config.get('GITLAB_TOKEN'))
}

const gitlab = gitLabClient()

router.get(
  '/:namespace/:project/:revisions',
  asyncMiddleware(async (request, response) => {
    try {
      const { namespace, project } = request.params

      const project_info = await gitlab.Projects.search(project)
      const project_match = getExactProjectMatch(namespace, project, project_info)

      const tags = await gitlab.Tags.all(project_match.id)

      const unsorted = tags.map(tag => {
        return {
          tag: tag.name,
          sha: tag.commit.id
        }
      })

      const result = unsorted.filter(x => x).sort((a, b) => (a.tag < b.tag ? 1 : a.tag > b.tag ? -1 : 0))
      return response.status(200).send(result)
    } catch (err) {
      logger.info(err)
      if (err.code === 404) return response.status(200).send([])
      // TODO what to do on non-404 errors? Log for sure but what do we give back to the caller?
      return response.status(200).send([])
    }
  })
)

router.get(
  '/:namespace{/:project}',
  asyncMiddleware(async (request, response) => {
    const { namespace, project } = request.params

    if (request.path.indexOf('/', 1) > 0) {
      let projects = await projectsByProjectName(namespace, project)
      return response.status(200).send(projects)
    }

    // In the GitLab API, a namespace can be either
    // a user or a group. Unfortunately, there is not
    // currently a way to get the projects associated
    // with a namespace through the GitLab Namespaces API
    // https://mfix.netl.doe.gov/gitlab/help/api/namespaces.md
    // We have to use either the User API or the Group API
    // First, we try the User API, then if that doesn't work we
    // try the Group API
    try {
      let projects = await getUserProjects(namespace)
      return response.status(200).send(projects)
    } catch (err) {
      logger.info(`Not able to find GitLab user ${namespace}`)
      logger.info(err)
      let projects = await getGroupProjects(namespace)
      return response.status(200).send(projects)
    }
  })
)

function setup() {
  return router
}

// We can't filter on namespace when searching for a project
// by name through the GitLab API, it will return all projects
// with matches for the search text in their project name
// This filters them by namespace
function getExactProjectMatch(namespace, project, projects) {
  let exact_match

  projects.filter(item => {
    if (item.path_with_namespace == `${namespace}/${project}`) {
      exact_match = item
    }
  })

  return exact_match
}

async function projectsByProjectName(namespace, project) {
  const projects = await gitlab.Projects.search(project)

  let project_names = projects.map(project => {
    return {
      id: project.path_with_namespace
    }
  })

  return project_names
}

async function getUserProjects(username) {
  const user_response = await getUsers(username)

  const user_projects = await gitlab.Users.projects(user_response[0].id)

  const user_project_names = user_projects.map(project => {
    return project.name
  })

  return user_project_names
}

async function getUsers(userName) {
  const users = await gitlab.Users.search(userName)

  let user_names = users.map(user => {
    return {
      id: user.id,
      username: user.username
    }
  })

  return user_names
}

async function getGroupProjects(groupName) {
  try {
    const group_response = await getGroups(groupName)

    const group_projects = await gitlab.Groups.projects(group_response[0])

    let group_project_names = group_projects.map(project => {
      return project.name
    })

    return group_project_names
  } catch (err) {
    logger.info(`Not able to find GitLab group ${groupName}`)
    logger.info(err)
    return []
  }
}

async function getGroups(groupName) {
  const groups = await gitlab.Groups.search(groupName)

  let group_names = groups.map(group => {
    return group.id
  })

  return group_names
}

module.exports = setup
