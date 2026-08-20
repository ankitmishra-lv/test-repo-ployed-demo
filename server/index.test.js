const assert = require("node:assert/strict");
const test = require("node:test");
const { app, resetTodos } = require("./index");

test.beforeEach(() => {
  resetTodos();
});

async function withServer(run) {
  const server = await new Promise((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

async function request(baseUrl, method, route, body) {
  const options = { method, headers: {} };

  if (body !== undefined) {
    options.headers["content-type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${route}`, options);
  const text = await response.text();

  return {
    response,
    text,
    body: text ? JSON.parse(text) : undefined
  };
}

function assertError(body, code) {
  assert.equal(typeof body.error.message, "string");
  assert.equal(body.error.code, code);
}

function assertTodo(todo, title, completed = false) {
  assert.match(
    todo.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
  assert.equal(todo.title, title);
  assert.equal(todo.completed, completed);
  assert.equal(new Date(todo.createdAt).toISOString(), todo.createdAt);
}

test("list empty", async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await request(baseUrl, "GET", "/api/todos");

    assert.equal(response.status, 200);
    assert.deepEqual(body, []);
  });
});

test("create", async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await request(baseUrl, "POST", "/api/todos", {
      title: "  Write tests  "
    });

    assert.equal(response.status, 201);
    assertTodo(body, "Write tests");
  });
});

test("reject empty title", async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await request(baseUrl, "POST", "/api/todos", {
      title: "   "
    });

    assert.equal(response.status, 400);
    assertError(body, "invalid_title");
  });
});

test("reject a 201-character title", async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await request(baseUrl, "POST", "/api/todos", {
      title: "a".repeat(201)
    });

    assert.equal(response.status, 400);
    assertError(body, "invalid_title");
  });
});

test("patch completed", async () => {
  await withServer(async (baseUrl) => {
    const createResult = await request(baseUrl, "POST", "/api/todos", {
      title: "Ship API"
    });

    const { response, body } = await request(
      baseUrl,
      "PATCH",
      `/api/todos/${createResult.body.id}`,
      { completed: true }
    );

    assert.equal(response.status, 200);
    assertTodo(body, "Ship API", true);
    assert.equal(body.id, createResult.body.id);
    assert.equal(body.createdAt, createResult.body.createdAt);
  });
});

test("patch an unknown id", async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await request(
      baseUrl,
      "PATCH",
      "/api/todos/00000000-0000-4000-8000-000000000000",
      { completed: true }
    );

    assert.equal(response.status, 404);
    assertError(body, "not_found");
  });
});

test("delete", async () => {
  await withServer(async (baseUrl) => {
    const createResult = await request(baseUrl, "POST", "/api/todos", {
      title: "Remove me"
    });

    const deleteResult = await request(
      baseUrl,
      "DELETE",
      `/api/todos/${createResult.body.id}`
    );

    assert.equal(deleteResult.response.status, 204);
    assert.equal(deleteResult.text, "");

    const listResult = await request(baseUrl, "GET", "/api/todos");
    assert.deepEqual(listResult.body, []);
  });
});
