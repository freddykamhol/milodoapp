type Button = { label: string; url: string };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildEmailHtml({
  preheader,
  title,
  intro,
  sections,
  button,
  footerNote,
  logoCid,
}: {
  preheader?: string;
  title: string;
  intro?: string;
  sections?: Array<{ label: string; value: string }>;
  button?: Button;
  footerNote?: string;
  logoCid?: string;
}) {
  const safeTitle = escapeHtml(title);
  const safeIntro = intro ? escapeHtml(intro).replaceAll("\n", "<br/>") : "";
  const safeFooter = footerNote ? escapeHtml(footerNote).replaceAll("\n", "<br/>") : "";
  const safePreheader = preheader ? escapeHtml(preheader) : "";

  const rows = (sections ?? [])
    .filter((s) => s.label.trim() && s.value.trim())
    .map(
      (s) => `
        <tr>
          <td style="padding:10px 0;border-top:1px solid #eef2f7;">
            <div style="font-size:12px;line-height:16px;color:#6b7280;font-weight:700;">${escapeHtml(s.label)}</div>
            <div style="font-size:15px;line-height:22px;color:#0b1220;font-weight:700;margin-top:4px;">${escapeHtml(s.value).replaceAll("\n", "<br/>")}</div>
          </td>
        </tr>
      `,
    )
    .join("");

  const buttonHtml = button
    ? `
      <div style="margin-top:20px;">
        <a href="${escapeHtml(button.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:14px;font-weight:800;font-size:14px;">
          ${escapeHtml(button.label)}
        </a>
      </div>
    `
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f8fc;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,'Apple Color Emoji','Segoe UI Emoji';">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fc;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">
            <tr>
              <td style="padding:10px 2px 14px 2px;">
                ${logoCid
                  ? `<img src="cid:${escapeHtml(logoCid)}" alt="MILODO Medical Group" width="190" style="display:block;width:190px;max-width:70%;height:auto;border:0;" />`
                  : `<div style="font-size:16px;color:#111827;font-weight:900;letter-spacing:0.08em;">MILODO</div>`}
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #e6ebf2;border-radius:20px;box-shadow:0 12px 30px rgba(11,18,32,0.06);overflow:hidden;">
                <div style="height:6px;background:#e11d48;font-size:0;line-height:0;">&nbsp;</div>
                <div style="padding:24px;">
                <div style="font-size:22px;line-height:28px;color:#0b1220;font-weight:900;">${safeTitle}</div>
                ${safeIntro ? `<div style="margin-top:10px;font-size:14px;line-height:20px;color:#4b5563;font-weight:600;">${safeIntro}</div>` : ""}

                ${rows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">${rows}</table>` : ""}

                ${buttonHtml}

                <div style="margin-top:22px;padding-top:16px;border-top:1px solid #eef2f7;font-size:12px;line-height:18px;color:#6b7280;font-weight:600;">
                  ${safeFooter || "Wenn du diese Nachricht unerwartet erhalten hast, kannst du sie ignorieren."}
                </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 2px 0 2px;">
                <div style="font-size:11px;line-height:16px;color:#94a3b8;font-weight:600;">
                  © ${new Date().getFullYear()} Milodo
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

