const path = require("node:path");
const { randomUUID } = require("node:crypto");
const express = require("express");

const app = express();
const todos = new Map();

app.use(express.json());

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function normalizeTitle(title) {
  if (typeof title !== "string") {
    return null;
  }

  const trimmed = title.trim();
  if (trimmed.length < 1 || trimmed.length > 200) {
    return null;
  }

  return trimmed;
}

function invalidTitle(res) {
  return sendError(
    res,
    400,
    "invalid_title",
    "Title must be between 1 and 200 characters."
  );
}

function invalidCompleted(res) {
  return sendError(res, 400, "invalid_completed", "Completed must be a boolean.");
}

function notFound(res) {
  return sendError(res, 404, "not_found", "Todo not found.");
}

app.get("/api/todos", (_req, res) => {
  res.status(200).json(Array.from(todos.values()).reverse());
});

app.post("/api/todos", (req, res) => {
  const title = normalizeTitle(req.body?.title);
  if (title === null) {
    return invalidTitle(res);
  }

  const todo = {
    id: randomUUID(),
    title,
    completed: false,
    createdAt: new Date().toISOString()
  };

  todos.set(todo.id, todo);

  return res.status(201).json(todo);
});

app.patch("/api/todos/:id", (req, res) => {
  const todo = todos.get(req.params.id);
  if (!todo) {
    return notFound(res);
  }

  const updates = {};

  if (Object.hasOwn(req.body ?? {}, "title")) {
    const title = normalizeTitle(req.body.title);
    if (title === null) {
      return invalidTitle(res);
    }
    updates.title = title;
  }

  if (Object.hasOwn(req.body ?? {}, "completed")) {
    if (typeof req.body.completed !== "boolean") {
      return invalidCompleted(res);
    }
    updates.completed = req.body.completed;
  }

  const updatedTodo = { ...todo, ...updates };
  todos.set(updatedTodo.id, updatedTodo);

  return res.status(200).json(updatedTodo);
});

app.delete("/api/todos/:id", (req, res) => {
  if (!todos.has(req.params.id)) {
    return notFound(res);
  }

  todos.delete(req.params.id);

  return res.status(204).send();
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.use((_req, res) => {
  return notFound(res);
});

app.use((err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof SyntaxError && "body" in err) {
    return sendError(res, 400, "invalid_json", "Request body must be valid JSON.");
  }

  return sendError(res, 500, "internal_error", "Internal server error.");
});

function resetTodos() {
  todos.clear();
}

function listen(port = process.env.PORT || 3000) {
  return app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

if (require.main === module) {
  listen();
}

module.exports = {
  app,
  listen,
  resetTodos
};
