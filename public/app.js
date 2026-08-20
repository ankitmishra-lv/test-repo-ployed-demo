(function () {
  const form = document.querySelector("#todo-form");
  const input = document.querySelector("#todo-title");
  const addButton = document.querySelector("#add-button");
  const errorBanner = document.querySelector("#error-banner");
  const errorMessage = document.querySelector("#error-message");
  const dismissError = document.querySelector("#dismiss-error");
  const status = document.querySelector("#todo-status");
  const list = document.querySelector("#todo-list");

  const state = {
    todos: [],
    loading: true,
    saving: false,
    busyIds: new Set()
  };

  function sortNewestFirst(todos) {
    return [...todos].sort((a, b) => {
      const aTime = Date.parse(a.createdAt) || 0;
      const bTime = Date.parse(b.createdAt) || 0;
      return bTime - aTime;
    });
  }

  function getErrorMessage(body, fallback) {
    return body && body.error && typeof body.error.message === "string"
      ? body.error.message
      : fallback;
  }

  async function requestJson(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    const requestOptions = { ...options, headers };

    if (Object.hasOwn(requestOptions, "body")) {
      headers["Content-Type"] = "application/json";
      requestOptions.body = JSON.stringify(requestOptions.body);
    }

    const response = await fetch(url, requestOptions);
    const text = await response.text();
    let body;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch (_error) {
        body = null;
      }
    }

    if (!response.ok) {
      throw new Error(getErrorMessage(body, "Something went wrong."));
    }

    return body;
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorBanner.hidden = false;
  }

  function clearError() {
    errorMessage.textContent = "";
    errorBanner.hidden = true;
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function createTodoRow(todo) {
    const item = document.createElement("li");
    item.className = "todo-item";
    if (todo.completed) {
      item.classList.add("is-completed");
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.disabled = state.busyIds.has(todo.id);
    checkbox.setAttribute(
      "aria-label",
      `${todo.completed ? "Mark incomplete" : "Mark complete"}: ${todo.title}`
    );
    checkbox.addEventListener("change", () => toggleTodo(todo));

    const title = document.createElement("span");
    title.className = "todo-title";
    title.textContent = todo.title;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.disabled = state.busyIds.has(todo.id);
    deleteButton.setAttribute("aria-label", `Delete todo: ${todo.title}`);
    deleteButton.addEventListener("click", () => deleteTodo(todo));

    item.append(checkbox, title, deleteButton);
    return item;
  }

  function render() {
    list.replaceChildren();

    if (state.loading) {
      setStatus("Loading todos...");
      return;
    }

    if (state.todos.length === 0) {
      setStatus("Nothing to do yet.");
      return;
    }

    setStatus("");
    const fragment = document.createDocumentFragment();
    sortNewestFirst(state.todos).forEach((todo) => {
      fragment.append(createTodoRow(todo));
    });
    list.append(fragment);
  }

  function setTodoBusy(id, isBusy) {
    if (isBusy) {
      state.busyIds.add(id);
    } else {
      state.busyIds.delete(id);
    }
    render();
  }

  async function loadTodos() {
    state.loading = true;
    render();

    try {
      const todos = await requestJson("/api/todos");
      state.todos = Array.isArray(todos) ? todos : [];
      clearError();
    } catch (error) {
      showError(error.message);
    } finally {
      state.loading = false;
      render();
    }
  }

  async function addTodo(event) {
    event.preventDefault();

    const title = input.value.trim();
    if (!title || state.saving) {
      return;
    }

    state.saving = true;
    addButton.disabled = true;

    try {
      const todo = await requestJson("/api/todos", {
        method: "POST",
        body: { title }
      });
      state.todos = sortNewestFirst([todo, ...state.todos]);
      input.value = "";
      clearError();
      render();
    } catch (error) {
      showError(error.message);
    } finally {
      state.saving = false;
      addButton.disabled = false;
      input.focus();
    }
  }

  async function toggleTodo(todo) {
    setTodoBusy(todo.id, true);

    try {
      const updatedTodo = await requestJson(`/api/todos/${todo.id}`, {
        method: "PATCH",
        body: { completed: !todo.completed }
      });
      state.todos = state.todos.map((currentTodo) =>
        currentTodo.id === updatedTodo.id ? updatedTodo : currentTodo
      );
      clearError();
    } catch (error) {
      showError(error.message);
    } finally {
      setTodoBusy(todo.id, false);
    }
  }

  async function deleteTodo(todo) {
    setTodoBusy(todo.id, true);

    try {
      await requestJson(`/api/todos/${todo.id}`, { method: "DELETE" });
      state.todos = state.todos.filter((currentTodo) => currentTodo.id !== todo.id);
      clearError();
    } catch (error) {
      showError(error.message);
    } finally {
      state.busyIds.delete(todo.id);
      render();
    }
  }

  form.addEventListener("submit", addTodo);
  dismissError.addEventListener("click", clearError);

  loadTodos();
})();
