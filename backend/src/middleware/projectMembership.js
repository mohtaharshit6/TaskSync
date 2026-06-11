const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Factory that returns a middleware resolving the project for the request,
// running exactly one ProjectMember query, and attaching req.membership.
// Responds 403 if the authenticated user has no membership row.
//
// Intermediate DB lookups (task, comment) are attached to req so the
// downstream controller can reuse them without a second round-trip.
//
// source values:
//   'project'       — projectId is req.params.id               (project routes)
//   'task:body'     — projectId is req.body.projectId           (POST /tasks)
//   'task:query'    — projectId is req.query.projectId          (GET  /tasks)
//   'task:param'    — look up Task by req.params.id             (GET|PUT|DELETE /tasks/:id)
//   'comment:body'  — look up Task by req.body.taskId           (POST /comments)
//   'comment:query' — look up Task by req.query.taskId          (GET  /comments)
//   'comment:param' — look up Comment by req.params.id → Task   (DELETE /comments/:id)

const requireProjectMember = (source) => async (req, res, next) => {
  try {
    let projectId;

    if (source === 'project') {
      // Project routes always carry :id directly in params
      projectId = req.params.id;

    } else if (source === 'task:body') {
      // Client supplies projectId when creating a task
      projectId = req.body.projectId;

    } else if (source === 'task:query') {
      // Client supplies projectId as a query param when listing tasks
      projectId = req.query.projectId;

    } else if (source === 'task:param') {
      // The URL only has a taskId; fetch the task to learn its project.
      // Attach to req so controllers skip a redundant query.
      const task = await prisma.task.findUnique({ where: { id: req.params.id } });
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
      req.task = task;
      projectId = task.projectId;

    } else if (source === 'comment:body') {
      // Resolve project through the parent task (taskId in body)
      const task = await prisma.task.findUnique({ where: { id: req.body.taskId } });
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
      req.task = task;
      projectId = task.projectId;

    } else if (source === 'comment:query') {
      // Resolve project through the parent task (taskId in query string)
      const task = await prisma.task.findUnique({ where: { id: req.query.taskId } });
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
      req.task = task;
      projectId = task.projectId;

    } else if (source === 'comment:param') {
      // Fetch comment and its task in one query; both are attached for reuse.
      const comment = await prisma.comment.findUnique({
        where: { id: req.params.id },
        include: { task: { select: { projectId: true } } }
      });
      if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });
      req.comment = comment;
      projectId = comment.task.projectId;
    }

    if (!projectId) {
      return res.status(400).json({ success: false, message: 'Project ID could not be resolved' });
    }

    // Single membership query — ProjectMember is the authoritative source of truth.
    // The project owner is always inserted as an 'admin' member at creation time,
    // so this check covers owners and regular members with one query.
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: req.user.id } }
    });

    if (!membership) {
      return res.status(403).json({ success: false, message: 'You are not a member of this project' });
    }

    // Expose to roleMiddleware and controllers so they read role without re-querying
    req.membership = membership;
    req.projectId  = projectId;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = requireProjectMember;
