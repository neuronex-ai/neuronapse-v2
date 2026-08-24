import { describe, expect, it } from "vitest";
import { renderNotionBlocksForImport } from "../notion-import-renderer";

describe("notion import renderer", () => {
  it("renders rich text annotations, links and equations", () => {
    const result = renderNotionBlocksForImport([
      {
        id: "paragraph-1",
        type: "paragraph",
        paragraph: {
          rich_text: [
            {
              type: "text",
              plain_text: "Clinico",
              annotations: { bold: true, italic: true },
            },
            {
              type: "text",
              plain_text: " Notion",
              href: "https://notion.so",
              annotations: {},
            },
            {
              type: "equation",
              plain_text: "x^2",
              equation: { expression: "x^2" },
              annotations: {},
            },
          ],
        },
      },
    ]);

    expect(result.contentHtml).toContain("<em><strong>Clinico</strong></em>");
    expect(result.contentHtml).toContain('href="https://notion.so"');
    expect(result.contentHtml).toContain('class="notion-inline-equation"');
    expect(result.unsupportedBlocks).toHaveLength(0);
  });

  it("groups lists, task items and tables into editor-friendly html", () => {
    const result = renderNotionBlocksForImport([
      {
        id: "bullet-1",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ plain_text: "Item A" }] },
      },
      {
        id: "bullet-2",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ plain_text: "Item B" }] },
      },
      {
        id: "task-1",
        type: "to_do",
        to_do: { checked: true, rich_text: [{ plain_text: "Feito" }] },
      },
      {
        id: "table-1",
        type: "table",
        table: { has_column_header: true },
        children: [
          { id: "row-1", type: "table_row", table_row: { cells: [[{ plain_text: "Nome" }], [{ plain_text: "Status" }]] } },
          { id: "row-2", type: "table_row", table_row: { cells: [[{ plain_text: "Ana" }], [{ plain_text: "Ok" }]] } },
        ],
      },
    ]);

    expect(result.contentHtml).toContain("<ul><li>Item A</li><li>Item B</li></ul>");
    expect(result.contentHtml).toContain('data-type="taskList"');
    expect(result.contentHtml).toContain('data-checked="true"');
    expect(result.contentHtml).toContain("<th>Nome</th>");
    expect(result.contentHtml).toContain("<td>Ana</td>");
  });

  it("keeps media cards and reports unsupported blocks", () => {
    const result = renderNotionBlocksForImport([
      {
        id: "child-1",
        type: "child_page",
        child_page: { title: "Plano terapeutico" },
        url: "https://notion.so/page",
      },
      {
        id: "pdf-1",
        type: "pdf",
        pdf: { external: { url: "https://example.com/file.pdf" }, caption: [{ plain_text: "Laudo" }] },
      },
      {
        id: "unknown-1",
        type: "unsupported",
        unsupported: { block_type: "future_block" },
      },
    ]);

    expect(result.contentHtml).toContain("<note-link");
    expect(result.contentHtml).toContain("Plano terapeutico");
    expect(result.contentHtml).toContain("<embedded-doc");
    expect(result.contentHtml).toContain('type="pdf"');
    expect(result.contentHtml).toContain("future_block");
    expect(result.unsupportedBlocks).toEqual([
      {
        id: "unknown-1",
        type: "unsupported",
        block_type: "future_block",
        reason: "Notion returned unsupported block",
      },
    ]);
  });
});
