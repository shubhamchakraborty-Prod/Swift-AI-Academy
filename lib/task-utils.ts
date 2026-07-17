export function isOverdue(task: { dueDate: Date | null; status: string }) {
  if (!task.dueDate) return false;
  if (task.status === "COMPLETED" || task.status === "SCRAPPED") return false;
  return task.dueDate.getTime() < Date.now();
}
