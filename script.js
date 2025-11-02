// Enhanced to-do list: duplicate detection + execute feature + persisted state
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("todo-form");
  const input = document.getElementById("todo-input");
  const list = document.getElementById("todo-list");
  const toast = document.getElementById("toast");

  // Helper: show toast message for a short time
  let toastTimer = null;
  function showToast(message, ms = 2500) {
    toast.textContent = message;
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
      toastTimer = null;
    }, ms);
  }

  // Helper: create a todo item DOM node from an item object
  function createTodoNode(item) {
    const li = document.createElement("li");
    li.className = "todo-item";
    if (item.completed) li.classList.add("completed");
    if (item.executed) li.classList.add("executed");

    // label
    const label = document.createElement("span");
    label.textContent = item.text;
    label.title = item.text;

    // Done button
    const doneBtn = document.createElement("button");
    doneBtn.type = "button";
    doneBtn.className = "btn-done";
    doneBtn.title = "Toggle completed";
    doneBtn.textContent = "✔";
    doneBtn.addEventListener("click", () => {
      li.classList.toggle("completed");
      saveState();
    });

    // Execute button
    const execBtn = document.createElement("button");
    execBtn.type = "button";
    execBtn.className = "btn-exec";
    execBtn.title = "Execute task";
    execBtn.textContent = "Execute";
    execBtn.addEventListener("click", () => {
      // If already executed, notify and do nothing (or toggle? we choose idempotent execute)
      if (li.dataset.executed === "true") {
        showToast(`Task already executed: "${item.text}"`);
        return;
      }
      // Mark executed, record timestamp
      const now = new Date();
      item.executed = true;
      item.executedAt = now.toISOString();
      li.dataset.executed = "true";
      li.classList.add("executed");
      refreshMeta(li, item);
      saveState();
      showToast(`Executed: "${item.text}"`);
      // Example "execution action": for demonstration, you could run additional JS here.
      // e.g., runTaskAction(item);
    });

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.title = "Remove";
    delBtn.textContent = "✖";
    delBtn.addEventListener("click", () => {
      li.remove();
      saveState();
    });

    li.appendChild(label);
    li.appendChild(doneBtn);
    li.appendChild(execBtn);
    li.appendChild(delBtn);

    // right side meta (timestamp)
    const meta = document.createElement("div");
    meta.className = "todo-meta";
    li.appendChild(meta);
    refreshMeta(li, item);

    // store item text on dataset for duplicate checks
    li.dataset.text = item.text;
    if (item.executed) li.dataset.executed = "true";

    return li;
  }

  function refreshMeta(li, item) {
    const meta = li.querySelector(".todo-meta");
    meta.innerHTML = "";
    if (item.executed && item.executedAt) {
      const span = document.createElement("div");
      span.className = "executed-badge";
      const d = new Date(item.executedAt);
      span.textContent = `Executed ${d.toLocaleString()}`;
      meta.appendChild(span);
    } else {
      const span = document.createElement("div");
      span.textContent = "Not executed";
      meta.appendChild(span);
    }
  }

  // Save and load state to localStorage
  function saveState() {
    const items = [];
    list.querySelectorAll(".todo-item").forEach((li) => {
      const text = li.dataset.text || li.querySelector("span").textContent;
      const completed = li.classList.contains("completed");
      const executed = li.dataset.executed === "true";
      const metaDiv = li.querySelector(".todo-meta");
      let executedAt = null;
      if (executed) {
        // try to get executedAt from the meta or from a bound object (we keep executedAt in dataset if available)
        executedAt = li.dataset.executedAt || null;
      }
      items.push({ text, completed, executed, executedAt });
    });
    try {
      localStorage.setItem("todo-items-v2", JSON.stringify(items));
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem("todo-items-v2");
      if (!raw) return false;
      const items = JSON.parse(raw);
      items.forEach((it) => {
        // ensure executedAt is present if executed but missing
        if (it.executed && !it.executedAt) it.executedAt = new Date().toISOString();
        const node = createTodoNode(it);
        // store executedAt in dataset for persistence retrieval (so saveState can read it)
        if (it.executedAt) node.dataset.executedAt = it.executedAt;
        list.appendChild(node);
      });
      return true;
    } catch (e) {
      console.warn("Could not load from localStorage", e);
      return false;
    }
  }

  // Check for duplicates (case-insensitive). Returns true if duplicate exists.
  function isDuplicate(text) {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return false;
    const nodes = list.querySelectorAll(".todo-item");
    for (const n of nodes) {
      const existing = (n.dataset.text || n.querySelector("span").textContent).trim().toLowerCase();
      if (existing === normalized) return true;
    }
    return false;
  }

  // Handle form submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    if (isDuplicate(value)) {
      showToast(`Task already added: "${value}"`);
      input.value = "";
      input.focus();
      return;
    }
    const item = { text: value, completed: false, executed: false, executedAt: null };
    const node = createTodoNode(item);
    // store dataset text for later duplicate checks and persistence
    node.dataset.text = item.text;
    list.prepend(node);
    input.value = "";
    input.focus();
    saveState();
    showToast(`Added: "${item.text}"`);
  });

  // Demo starter tasks if nothing in storage
  if (!loadState()) {
    const starters = [
      { text: "Try adding a task", completed: false, executed: false, executedAt: null },
      { text: "Click ✔ to mark complete", completed: false, executed: false, executedAt: null }
    ];
    starters.forEach((t) => {
      const node = createTodoNode(t);
      node.dataset.text = t.text;
      list.appendChild(node);
    });
    saveState();
  }

  // Optional: expose a function for programmatic "execution" of a task (by text)
  // Example usage: runTask("Try adding a task")
  window.runTask = function(taskText) {
    const normalized = taskText.trim().toLowerCase();
    const nodes = list.querySelectorAll(".todo-item");
    for (const n of nodes) {
      const existing = (n.dataset.text || n.querySelector("span").textContent).trim().toLowerCase();
      if (existing === normalized) {
        // simulate clicking Execute button
        const execBtn = n.querySelector(".btn-exec");
        if (execBtn) execBtn.click();
        return true;
      }
    }
    // not found
    showToast(`Task not found: "${taskText}"`);
    return false;
  };
});