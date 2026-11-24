// Task controller — start/pause/resume/stop organic viewer tasks.
const taskService = require('../services/taskService');
const activityService = require('../services/activityService');
const { validateVideoUrl } = require('../services/platformService');

function startTask(req, res) {
  const url = req.body && typeof req.body.url === 'string' ? req.body.url.trim() : '';
  const validation = validateVideoUrl(url);
  if (!validation.ok) {
    return res.status(400).json(validation);
  }
  const task = taskService.startTask(validation.platform, validation.normalized, validation.videoId);
  return res.status(201).json({ ok: true, task });
}

function findTaskOr404(id) {
  return taskService.findTask(Number(id));
}

function sendTaskAction(id, mutate, okMessage) {
  const task = findTaskOr404(id);
  if (!task) return null;
  mutate(task);
  return { ok: true, task: taskService.findTask(task.id) || task };
}

function pauseTask(req, res) {
  const task = findTaskOr404(req.params.id);
  if (!task) return res.status(404).json({ ok: false, error: 'not_found', message: 'Task not found' });
  res.json(sendTaskAction(req.params.id, () => taskService.pauseTask(task.id)));
}

function resumeTask(req, res) {
  const task = findTaskOr404(req.params.id);
  if (!task) return res.status(404).json({ ok: false, error: 'not_found', message: 'Task not found' });
  res.json(sendTaskAction(req.params.id, () => taskService.resumeTask(task.id)));
}

function stopTask(req, res) {
  const task = findTaskOr404(req.params.id);
  if (!task) return res.status(404).json({ ok: false, error: 'not_found', message: 'Task not found' });
  res.json(sendTaskAction(req.params.id, () => taskService.stopTask(task.id)));
}

function deleteTask(req, res) {
  const task = findTaskOr404(req.params.id);
  if (!task) return res.status(404).json({ ok: false, error: 'not_found', message: 'Task not found' });
  taskService.deleteTask(task.id);
  res.json({ ok: true, message: `Task #${task.id} deleted` });
}

function getTasks(req, res) {
  const tasks = taskService.getTasks();
  const list = (Array.isArray(tasks) ? tasks : []).map((t) => ({
    id: t.id, platform: t.platform, videoId: t.videoId, url: t.url,
    status: t.status, requestsSent: t.requestsSent, errors: t.errors,
    startedAt: t.startedAt, finishedAt: t.finishedAt, maxRequests: t.maxRequests
  }));
  res.json({ ok: true, tasks: list });
}

module.exports = { startTask, pauseTask, resumeTask, stopTask, deleteTask, getTasks };
