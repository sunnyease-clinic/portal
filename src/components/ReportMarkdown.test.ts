import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ReportMarkdown from "./ReportMarkdown";

describe("ReportMarkdown", () => {
  it("renders mark tags and removes unsafe HTML", () => {
    const html = renderToStaticMarkup(createElement(ReportMarkdown, { content: '一般 <mark>重要提醒</mark><script>alert("x")</script>' }));
    expect(html).toContain("<mark>重要提醒</mark>");
    expect(html).not.toContain("<script");
  });
});
