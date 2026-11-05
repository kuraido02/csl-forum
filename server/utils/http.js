// Send an error in the format from docs/api-contract.md
function sendError(res, status, code, message, fields) {
  const error = { code, message };
  if (fields) error.fields = fields;
  return res.status(status).json({ error });
}

// Turn a zod validation error into a 400 response
function sendValidationError(res, zodError) {
  const fields = {};
  for (const issue of zodError.issues) {
    const key = issue.path[0];
    if (!fields[key]) fields[key] = issue.message;
  }
  return sendError(res, 400, "VALIDATION_ERROR", "Please fix the highlighted fields.", fields);
}

module.exports = { sendError, sendValidationError };