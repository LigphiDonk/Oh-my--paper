import { corsHeaders, verifyRequestAuth } from "./auth";
import { DocumentRoom } from "./document-room";

export { DocumentRoom };

type ProjectRole = "owner" | "editor" | "commenter" | "viewer";

interface Env {
  DOCUMENT_ROOM: DurableObjectNamespace;
  DB: D1Database;
  ALLOW_INSECURE_AUTH?: string;
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(),
      ...(init?.headers ?? {}),
    },
  });
}

function html(markup: string, init?: ResponseInit) {
  return new Response(markup, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function roleLabel(role: ProjectRole | null | undefined) {
  if (role === "owner") return "所有者";
  if (role === "editor") return "可编辑";
  if (role === "commenter") return "可批注";
  if (role === "viewer") return "只读";
  return "未指定";
}

function parseProjectRole(value: unknown): ProjectRole | null {
  if (value === "owner" || value === "editor" || value === "commenter" || value === "viewer") {
    return value;
  }
  return null;
}

function rolePriority(role: ProjectRole) {
  if (role === "owner") return 3;
  if (role === "editor") return 2;
  if (role === "commenter") return 1;
  return 0;
}

function chooseProjectRole(current: ProjectRole | null, requested: ProjectRole) {
  if (!current) {
    return requested;
  }
  return rolePriority(current) >= rolePriority(requested) ? current : requested;
}

function renderJoinPage(projectId: string, projectName: string | null, shareLink: string, invitedRole: ProjectRole) {
  const safeProjectId = escapeHtml(projectId);
  const safeProjectName = escapeHtml(projectName?.trim() || "ViewerLeaf Cloud Project");
  const safeShareLink = escapeHtml(shareLink);
  const safeRole = escapeHtml(roleLabel(invitedRole));

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>加入 ViewerLeaf 云项目</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f2eb;
        --card: rgba(255, 252, 245, 0.94);
        --text: #1f2937;
        --muted: #5f6b7a;
        --line: rgba(31, 41, 55, 0.12);
        --accent: #0f766e;
        --accent-strong: #115e59;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(15, 118, 110, 0.14), transparent 28rem),
          linear-gradient(180deg, #f8f5ef 0%, var(--bg) 100%);
        color: var(--text);
      }
      main {
        width: min(46rem, calc(100vw - 2rem));
        margin: 0 auto;
        padding: 3rem 0 4rem;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 1.5rem;
        box-shadow: 0 18px 60px rgba(15, 23, 42, 0.08);
        backdrop-filter: blur(18px);
      }
      h1 {
        margin: 0 0 0.5rem;
        font-size: clamp(2rem, 5vw, 3rem);
        line-height: 1.05;
      }
      p {
        margin: 0.75rem 0 0;
        color: var(--muted);
        line-height: 1.65;
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 0.8rem;
        border-radius: 999px;
        background: rgba(15, 118, 110, 0.1);
        color: var(--accent-strong);
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .section {
        margin-top: 1.25rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--line);
      }
      .label {
        display: block;
        margin-bottom: 0.5rem;
        color: var(--muted);
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .value {
        width: 100%;
        padding: 0.9rem 1rem;
        border-radius: 16px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.7);
        color: var(--text);
        font: inherit;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 0.8rem 1.1rem;
        background: var(--accent);
        color: white;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      button.secondary {
        background: rgba(15, 118, 110, 0.12);
        color: var(--accent-strong);
      }
      ol {
        margin: 1rem 0 0;
        padding-left: 1.25rem;
        color: var(--muted);
      }
      li + li {
        margin-top: 0.55rem;
      }
      .status {
        min-height: 1.25rem;
        margin-top: 0.85rem;
        color: var(--accent-strong);
        font-size: 0.92rem;
      }
      code {
        font-family: "SF Mono", "JetBrains Mono", monospace;
        font-size: 0.94em;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <div class="eyebrow">ViewerLeaf Cloud</div>
        <h1>加入共享项目</h1>
        <p>这个链接现在可以正常打开了，但它不会直接在浏览器里进入编辑器。ViewerLeaf 目前的协作入口仍在桌面端。</p>

        <div class="section">
          <span class="label">项目名称</span>
          <input class="value" value="${safeProjectName}" readonly />
        </div>

        <div class="section">
          <span class="label">Project ID</span>
          <input id="project-id" class="value" value="${safeProjectId}" readonly />
          <div class="actions">
            <button type="button" onclick="copyValue('project-id', '已复制 Project ID')">复制 Project ID</button>
          </div>
        </div>

        <div class="section">
          <span class="label">分享链接</span>
          <input id="share-link" class="value" value="${safeShareLink}" readonly />
          <div class="actions">
            <button type="button" class="secondary" onclick="copyValue('share-link', '已复制分享链接')">复制分享链接</button>
          </div>
        </div>

        <div class="section">
          <span class="label">分享权限</span>
          <input class="value" value="${safeRole}" readonly />
        </div>

        <div class="section">
          <span class="label">如何加入</span>
          <ol>
            <li>打开 ViewerLeaf 桌面应用，并登录同一个协作服务器。</li>
            <li>进入云协作面板，点击“关联已有项目”。</li>
            <li>直接粘贴这个分享链接，或者只粘贴上面的 Project ID。</li>
          </ol>
          <div id="status" class="status" aria-live="polite"></div>
        </div>
      </div>
    </main>
    <script>
      async function copyValue(id, message) {
        const input = document.getElementById(id);
        const status = document.getElementById("status");
        if (!input || !status) return;
        try {
          await navigator.clipboard.writeText(input.value);
          status.textContent = message;
        } catch {
          input.select();
          document.execCommand("copy");
          status.textContent = message;
        }
      }
    </script>
  </body>
</html>`;
}

function textFileKind(path: string) {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "bib") {
    return "bib";
  }
  if (["tex", "sty", "cls"].includes(extension)) {
    return "tex";
  }
  return "text";
}

async function upsertUser(env: Env, user: Awaited<ReturnType<typeof verifyRequestAuth>>) {
  await env.DB.prepare(
    `INSERT INTO users (id, email, name, avatar_url)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       avatar_url = excluded.avatar_url`,
  )
    .bind(user.id, user.email, user.name, user.avatarUrl)
    .run();
}

async function requireProjectRole(env: Env, projectId: string, userId: string) {
  const row = await env.DB.prepare(
    `SELECT role FROM project_members WHERE project_id = ?1 AND user_id = ?2 LIMIT 1`,
  )
    .bind(projectId, userId)
    .first<{ role: ProjectRole }>();

  if (!row) {
    throw json(
      {
        error: "forbidden",
        message: "You are not a member of this project.",
      },
      { status: 403 },
    );
  }

  return row.role;
}

async function ensureDocument(env: Env, projectId: string, path: string) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO documents (id, project_id, path, kind)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(project_id, path) DO UPDATE SET
       kind = excluded.kind,
       updated_at = datetime('now')`,
  )
    .bind(id, projectId, path, textFileKind(path))
    .run();
}

async function touchDocument(env: Env, projectId: string, path: string) {
  await env.DB.prepare(
    `UPDATE documents
     SET latest_version = latest_version + 1,
         updated_at = datetime('now')
     WHERE project_id = ?1 AND path = ?2`,
  )
    .bind(projectId, path)
    .run();

  await env.DB.prepare(
    `UPDATE projects
     SET updated_at = datetime('now')
     WHERE id = ?1`,
  )
    .bind(projectId)
    .run();

  const row = await env.DB.prepare(
    `SELECT latest_version AS latestVersion
     FROM documents
     WHERE project_id = ?1 AND path = ?2
     LIMIT 1`,
  )
    .bind(projectId, path)
    .first<{ latestVersion: number }>();

  return row?.latestVersion ?? 0;
}

function projectRoomStub(env: Env, projectId: string, path: string) {
  return env.DOCUMENT_ROOM.get(env.DOCUMENT_ROOM.idFromName(`${projectId}:${path}`));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/health") {
        return json({ ok: true });
      }

      if (url.pathname === "/favicon.ico") {
        return new Response(null, { status: 204 });
      }

      const publicJoinMatch = url.pathname.match(/^\/join\/([^/]+)$/);
      if (publicJoinMatch && request.method === "GET") {
        const projectId = publicJoinMatch[1];
        const invitedRole = parseProjectRole(url.searchParams.get("role")) ?? "viewer";
        const project = await env.DB.prepare(
          `SELECT name FROM projects WHERE id = ?1 LIMIT 1`,
        )
          .bind(projectId)
          .first<{ name: string }>();
        if (!project) {
          return html(renderJoinPage(projectId, null, url.toString(), invitedRole), { status: 404 });
        }
        return html(renderJoinPage(projectId, project.name, url.toString(), invitedRole));
      }

      const user = await verifyRequestAuth(request, env);
      await upsertUser(env, user);

      if (url.pathname === "/api/projects" && request.method === "GET") {
        const result = await env.DB.prepare(
          `SELECT p.id, p.name, p.root_main_file AS rootMainFile, pm.role, p.created_at AS createdAt, p.updated_at AS updatedAt
           FROM projects p
           INNER JOIN project_members pm ON pm.project_id = p.id
           WHERE pm.user_id = ?1
           ORDER BY p.updated_at DESC`,
        )
          .bind(user.id)
          .all();
        return json({ projects: result.results });
      }

      if (url.pathname === "/api/projects" && request.method === "POST") {
        const body = await request.json<unknown>().catch(() => null);
        const projectId = crypto.randomUUID();
        const name = readTrimmedString(isRecord(body) ? body.name : undefined) || "Untitled Project";
        const rootMainFile =
          readTrimmedString(isRecord(body) ? body.rootMainFile : undefined) || "main.tex";

        await env.DB.prepare(
          `INSERT INTO projects (id, name, owner_user_id, root_main_file)
           VALUES (?1, ?2, ?3, ?4)`,
        )
          .bind(projectId, name, user.id, rootMainFile)
          .run();
        await env.DB.prepare(
          `INSERT INTO project_members (project_id, user_id, role) VALUES (?1, ?2, 'owner')`,
        )
          .bind(projectId, user.id)
          .run();

        return json({ projectId, name, rootMainFile }, { status: 201 });
      }

      const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (projectMatch && request.method === "GET") {
        const projectId = projectMatch[1];
        const role = await requireProjectRole(env, projectId, user.id);
        const project = await env.DB.prepare(
          `SELECT id, name, owner_user_id AS ownerUserId, root_main_file AS rootMainFile,
                  created_at AS createdAt, updated_at AS updatedAt
           FROM projects
           WHERE id = ?1
           LIMIT 1`,
        )
          .bind(projectId)
          .first();
        return json({ project, role });
      }

      const docsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/documents$/);
      if (docsMatch && request.method === "GET") {
        const projectId = docsMatch[1];
        await requireProjectRole(env, projectId, user.id);
        const result = await env.DB.prepare(
          `SELECT id, project_id AS projectId, path, kind, latest_version AS latestVersion, updated_at AS updatedAt
           FROM documents
           WHERE project_id = ?1
           ORDER BY path ASC`,
        )
          .bind(projectId)
          .all();
        return json({ documents: result.results });
      }

      if (docsMatch && request.method === "POST") {
        const projectId = docsMatch[1];
        await requireProjectRole(env, projectId, user.id);
        const body = await request.json<unknown>().catch(() => null);
        const path = readTrimmedString(isRecord(body) ? body.path : undefined);
        if (!path) {
          return json({ error: "invalid_path" }, { status: 400 });
        }
        await ensureDocument(env, projectId, path);
        return json({ ok: true }, { status: 201 });
      }

      const snapshotMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/documents\/snapshot$/);
      if (snapshotMatch && request.method === "GET") {
        const projectId = snapshotMatch[1];
        await requireProjectRole(env, projectId, user.id);
        const path = url.searchParams.get("path")?.trim();
        if (!path) {
          return json({ error: "missing_path" }, { status: 400 });
        }
        await ensureDocument(env, projectId, path);
        const stub = projectRoomStub(env, projectId, path);
        const snapshotResponse = await stub.fetch("https://viewerleaf.internal/snapshot");
        return new Response(snapshotResponse.body, {
          status: snapshotResponse.status,
          headers: {
            "content-type": "application/octet-stream",
            "cache-control": "no-store",
            ...corsHeaders(),
          },
        });
      }

      if (snapshotMatch && request.method === "POST") {
        const projectId = snapshotMatch[1];
        const role = await requireProjectRole(env, projectId, user.id);
        if (role === "viewer") {
          return json({ error: "read_only" }, { status: 403 });
        }
        const path = url.searchParams.get("path")?.trim();
        if (!path) {
          return json({ error: "missing_path" }, { status: 400 });
        }
        await ensureDocument(env, projectId, path);
        const payload = await request.arrayBuffer();
        const stub = projectRoomStub(env, projectId, path);
        const uploadResponse = await stub.fetch("https://viewerleaf.internal/snapshot", {
          method: "POST",
          headers: {
            "content-type": "application/octet-stream",
            "x-viewerleaf-role": role,
          },
          body: payload,
        });
        if (!uploadResponse.ok) {
          const errorHeaders = new Headers(uploadResponse.headers);
          for (const [key, value] of Object.entries(corsHeaders())) {
            errorHeaders.set(key, value);
          }
          return new Response(uploadResponse.body, {
            status: uploadResponse.status,
            headers: errorHeaders,
          });
        }
        const latestVersion = await touchDocument(env, projectId, path);
        return json({ ok: true, latestVersion });
      }

      const wsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/ws$/);
      if (wsMatch) {
        const projectId = wsMatch[1];
        const role = await requireProjectRole(env, projectId, user.id);
        const path = url.searchParams.get("path")?.trim();
        if (!path) {
          return json({ error: "missing_path" }, { status: 400 });
        }
        await ensureDocument(env, projectId, path);
        const stub = projectRoomStub(env, projectId, path);
        const forwardedHeaders = new Headers(request.headers);
        forwardedHeaders.set("x-viewerleaf-user-id", user.id);
        forwardedHeaders.set("x-viewerleaf-role", role);
        // Clone the original upgrade request so the WebSocket handshake survives
        // the hop into the Durable Object.
        const forwardedRequest = new Request(
          `https://viewerleaf.internal/ws?path=${encodeURIComponent(path)}`,
          request,
        );
        forwardedRequest.headers.set("x-viewerleaf-user-id", user.id);
        forwardedRequest.headers.set("x-viewerleaf-role", role);
        for (const [key, value] of forwardedHeaders.entries()) {
          if (key === "x-viewerleaf-user-id" || key === "x-viewerleaf-role") {
            forwardedRequest.headers.set(key, value);
          }
        }
        return stub.fetch(forwardedRequest);
      }

      const joinMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/join$/);
      if (joinMatch && request.method === "POST") {
        const projectId = joinMatch[1];
        const body = await request.json<unknown>().catch(() => null);
        const requestedRole =
          parseProjectRole(isRecord(body) ? body.role : undefined) ?? parseProjectRole(url.searchParams.get("role"));
        const project = await env.DB.prepare(
          `SELECT id FROM projects WHERE id = ?1 LIMIT 1`,
        )
          .bind(projectId)
          .first();
        if (!project) {
          return json({ error: "not_found", message: "Project not found." }, { status: 404 });
        }
        const existing = await env.DB.prepare(
          `SELECT role FROM project_members WHERE project_id = ?1 AND user_id = ?2 LIMIT 1`,
        )
          .bind(projectId, user.id)
          .first<{ role: ProjectRole }>();
        const nextRole = chooseProjectRole(existing?.role ?? null, requestedRole ?? existing?.role ?? "editor");
        if (existing) {
          await env.DB.prepare(
            `UPDATE project_members
             SET role = ?3
             WHERE project_id = ?1 AND user_id = ?2`,
          )
            .bind(projectId, user.id, nextRole)
            .run();
        } else {
          await env.DB.prepare(
            `INSERT INTO project_members (project_id, user_id, role)
             VALUES (?1, ?2, ?3)`,
          )
            .bind(projectId, user.id, nextRole)
            .run();
        }
        return json({ ok: true, role: nextRole });
      }

      const membersMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/members$/);
      if (membersMatch && request.method === "GET") {
        const projectId = membersMatch[1];
        await requireProjectRole(env, projectId, user.id);
        const result = await env.DB.prepare(
          `SELECT pm.user_id AS userId, pm.role, u.name, u.email, u.avatar_url AS avatarUrl
           FROM project_members pm INNER JOIN users u ON u.id = pm.user_id
           WHERE pm.project_id = ?1`,
        )
          .bind(projectId)
          .all();
        return json({ members: result.results });
      }

      return json({ error: "not_found" }, { status: 404 });
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      console.error("worker request failed", error);
      return json(
        {
          error: "internal_error",
          message: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      );
    }
  },
};
