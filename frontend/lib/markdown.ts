/**
 * Minimal markdown → React-safe HTML renderer.
 * Handles: **bold**, *italic*, `code`, ## headings, - bullet lists,
 * numbered lists, and ~~strikethrough~~. No external dependencies.
 */

export function renderMarkdown(text: string): string {
    let html = text
        // Escape raw HTML first
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Block-level: headings
    html = html.replace(/^### (.+)$/gm, "<h4 style=\"font-size:13px;font-weight:700;margin:12px 0 4px\">$1</h4>");
    html = html.replace(/^## (.+)$/gm, "<h3 style=\"font-size:14px;font-weight:700;margin:12px 0 4px\">$1</h3>");
    html = html.replace(/^# (.+)$/gm, "<h3 style=\"font-size:15px;font-weight:700;margin:12px 0 6px\">$1</h3>");

    // Bold, italic, code spans
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/`([^`]+)`/g, "<code style=\"background:#E2E8F0;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.9em\">$1</code>");
    html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

    // Bullet lists — group adjacent - lines into <ul>
    html = html.replace(/((?:^[ \t]*[-*] .+\n?)+)/gm, (block) => {
        const items = block.trim().split("\n").map(line =>
            `<li style="margin:3px 0">${line.replace(/^[ \t]*[-*] /, "").trim()}</li>`
        ).join("");
        return `<ul style="margin:6px 0 6px 18px;padding:0;list-style:disc">${items}</ul>`;
    });

    // Numbered lists — group adjacent `N. ` lines
    html = html.replace(/((?:^[ \t]*\d+\. .+\n?)+)/gm, (block) => {
        const items = block.trim().split("\n").map(line =>
            `<li style="margin:3px 0">${line.replace(/^[ \t]*\d+\. /, "").trim()}</li>`
        ).join("");
        return `<ol style="margin:6px 0 6px 18px;padding:0">${items}</ol>`;
    });

    // Horizontal rule
    html = html.replace(/^---+$/gm, "<hr style=\"border:none;border-top:1px solid #E2E8F0;margin:12px 0\">");

    // Paragraphs / line breaks: blank lines → paragraph break, single newlines → <br>
    html = html.replace(/\n\n+/g, "</p><p style=\"margin:8px 0\">");
    html = html.replace(/\n/g, "<br>");
    html = `<p style="margin:0">${html}</p>`;

    // Clean up empty paragraphs
    html = html.replace(/<p[^>]*><\/p>/g, "");

    return html;
}
