import sanitizeHtml from "sanitize-html";

const length = /^(?:0|\d+(?:\.\d+)?(?:px|pt|em|rem|%))$/i;

// The same allowlist is applied before insertion and before server-side rendering.
export function sanitizeBlogHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "div", "span", "br", "h1", "h2", "h3", "h4", "h5", "h6", "b", "strong", "i", "em", "u", "s", "del", "strike", "a", "ul", "ol", "li", "blockquote", "pre", "code", "hr", "sub", "sup", "table", "thead", "tbody", "tr", "td", "th"],
    allowedAttributes: { "*": ["style"], a: ["href", "title"], ol: ["start"], li: ["value"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        "font-size": [length],
        "font-family": [/^[\w\s,'"-]+$/],
        "font-weight": [/^(?:normal|bold|[1-9]00)$/],
        "font-style": [/^(?:normal|italic|oblique)$/],
        "text-decoration": [/^(?:none|underline|line-through|underline line-through)$/],
        "text-decoration-line": [/^(?:none|underline|line-through|underline line-through)$/],
        "text-align": [/^(?:left|right|center|justify|start|end)$/],
        "line-height": [/^(?:normal|\d+(?:\.\d+)?(?:px|pt|em|rem|%)?)$/],
        "margin-top": [length], "margin-bottom": [length],
        "margin-left": [length], "margin-right": [length],
        "padding-left": [length],
        "white-space": [/^(?:normal|pre|pre-wrap|break-spaces)$/],
        "color": [/^#[\da-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
        "background-color": [/^#[\da-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
      },
    },
  });
}

export function plainTextToBlogHtml(text: string): string {
  const escaped = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return escaped.replace(/\r\n?/g, "\n").split("\n").map((line) => `<p>${line || "<br>"}</p>`).join("");
}
