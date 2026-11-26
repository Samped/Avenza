/** Minimal markdown renderer — no external deps. */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveDocHref(href: string, docBase: string): string {
  const raw = String(href).trim();
  if (raw.startsWith("http") || raw.startsWith("/") || raw.startsWith("#")) return raw;
  const md = raw.match(/^(?:\.\/)?([a-z0-9-]+)\.md(?:#(.+))?$/i);
  if (md) {
    const slug = md[1]!;
    const hash = md[2] ? `#${md[2]}` : "";
    return `${docBase}/${slug}${hash}`;
  }
  return "#";
}

function inlineFormat(text: string, docBase: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code class="doc-code">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const safe = resolveDocHref(href, docBase);
    return `<a href="${escapeHtml(safe)}" class="doc-link">${label}</a>`;
  });
  return s;
}

export function Markdown({ source, docBase = "/docs" }: { source: string; docBase?: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  let inCode = false;
  let codeBuf: string[] = [];
  let listBuf: string[] = [];
  let tableBuf: string[] = [];

  const flushList = () => {
    if (!listBuf.length) return;
    html.push(
      `<ul class="doc-ul">${listBuf.map((li) => `<li>${inlineFormat(li, docBase)}</li>`).join("")}</ul>`,
    );
    listBuf = [];
  };

  const flushTable = () => {
    if (tableBuf.length < 2) {
      tableBuf = [];
      return;
    }
    const rows = tableBuf.map((r) =>
      r
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim()),
    );
    const head = rows[0]!;
    const body = rows.slice(2); // skip separator
    html.push('<div class="doc-table-wrap"><table class="doc-table"><thead><tr>');
    head.forEach((c) => html.push(`<th>${inlineFormat(c, docBase)}</th>`));
    html.push("</tr></thead><tbody>");
    body.forEach((row) => {
      html.push("<tr>");
      row.forEach((c) => html.push(`<td>${inlineFormat(c, docBase)}</td>`));
      html.push("</tr>");
    });
    html.push("</tbody></table></div>");
    tableBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.startsWith("```")) {
      flushList();
      flushTable();
      if (!inCode) {
        inCode = true;
        codeBuf = [];
      } else {
        html.push(`<pre class="doc-pre"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
        inCode = false;
        codeBuf = [];
      }
      i++;
      continue;
    }

    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    if (line.trim().startsWith("|") && line.includes("|")) {
      flushList();
      tableBuf.push(line);
      i++;
      continue;
    }
    if (tableBuf.length) flushTable();

    if (/^[-*] /.test(line)) {
      listBuf.push(line.replace(/^[-*] /, ""));
      i++;
      continue;
    }
    if (listBuf.length) flushList();

    if (line.startsWith("# ")) {
      html.push(`<h1 class="doc-h1">${inlineFormat(line.slice(2), docBase)}</h1>`);
    } else if (line.startsWith("## ")) {
      html.push(`<h2 class="doc-h2">${inlineFormat(line.slice(3), docBase)}</h2>`);
    } else if (line.startsWith("### ")) {
      html.push(`<h3 class="doc-h3">${inlineFormat(line.slice(4), docBase)}</h3>`);
    } else if (line.trim() === "" || line.trim() === "---") {
      html.push('<div class="doc-spacer"></div>');
    } else {
      html.push(`<p class="doc-p">${inlineFormat(line, docBase)}</p>`);
    }
    i++;
  }
  flushList();
  flushTable();

  return <div className="doc-body" dangerouslySetInnerHTML={{ __html: html.join("\n") }} />;
}
