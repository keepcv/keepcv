import type { ResumeDocument, RichText } from "@keepcv/schema";
import { strToU8, zipSync } from "fflate";
import type { BlockRole, ResumeBlock } from "../blocks.js";
import { toBlocks } from "../blocks.js";

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";

const ESCAPED: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const escapeXml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ESCAPED[character] ?? character);

// The style each role is written as, chosen so the file reads back: `docxLines`
// takes the shallowest heading level as the section level and everything bold
// or deeper as an entry head, which is exactly what these mean in Word too.
const STYLE: Record<BlockRole, string | undefined> = {
  name: "Title",
  headline: "Subtitle",
  contacts: undefined,
  heading: "Heading1",
  entry: "Heading2",
  detail: undefined,
  note: undefined,
  point: "ListParagraph",
};

interface Marks {
  bold: boolean;
  italic: boolean;
  href: string | undefined;
}

interface Run extends Marks {
  text: string;
}

function flatten(nodes: RichText, marks: Marks): Run[] {
  return nodes.flatMap((node) => {
    if (node.t === "text") return node.v === "" ? [] : [{ ...marks, text: node.v }];
    if (node.t === "b") return flatten(node.c, { ...marks, bold: true });
    if (node.t === "i") return flatten(node.c, { ...marks, italic: true });
    return flatten(node.c, { ...marks, href: node.href });
  });
}

// `xml:space="preserve"` or Word drops the space between two runs, which is how
// a bold word ends up joined to the one after it.
function runXml(run: Run): string {
  const props = [run.bold ? "<w:b/>" : "", run.italic ? "<w:i/>" : ""].join("");
  const style = run.href === undefined ? props : `${props}<w:rStyle w:val="Hyperlink"/>`;
  const properties = style === "" ? "" : `<w:rPr>${style}</w:rPr>`;
  return `<w:r>${properties}<w:t xml:space="preserve">${escapeXml(run.text)}</w:t></w:r>`;
}

class Links {
  private readonly targets = new Map<string, string>();

  idFor(url: string): string {
    const found = this.targets.get(url);
    if (found !== undefined) return found;
    const id = `rHref${String(this.targets.size + 1)}`;
    this.targets.set(url, id);
    return id;
  }

  relationships(): string {
    return [...this.targets]
      .map(
        ([url, id]) =>
          `<Relationship Id="${id}" Type="${REL}/hyperlink" Target="${escapeXml(url)}" TargetMode="External"/>`,
      )
      .join("");
  }
}

// An entry head sets its period at a right tab stop, which is the only way a
// word processor puts two things on one line without a table or a frame.
const TAB_STOP = '<w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs>';

function paragraph(one: ResumeBlock, links: Links): string {
  const style = STYLE[one.role];
  const named = style === undefined ? "" : `<w:pStyle w:val="${style}"/>`;
  const listed =
    one.role === "point" ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : "";
  const centred = one.role === "contacts" ? '<w:jc w:val="center"/>' : "";
  const tabbed = one.aside === undefined ? "" : TAB_STOP;
  // `w:pPr` is a sequence, not a set: `w:tabs` comes before `w:jc` and a
  // validator refuses the other order.
  const properties = `<w:pPr>${named}${listed}${tabbed}${centred}</w:pPr>`;

  const runs = flatten(one.text, { bold: false, italic: false, href: undefined })
    .map((run) =>
      run.href === undefined
        ? runXml(run)
        : `<w:hyperlink r:id="${links.idFor(run.href)}">${runXml(run)}</w:hyperlink>`,
    )
    .join("");

  const aside =
    one.aside === undefined
      ? ""
      : `<w:r><w:tab/></w:r>${runXml({ text: one.aside, bold: false, italic: false, href: undefined })}`;

  return `<w:p>${properties}${runs}${aside}</w:p>`;
}

const SECTION = [
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>',
  '<w:pgMar w:top="1021" w:right="1021" w:bottom="1021" w:left="1021"',
  ' w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>',
].join("");

const style = (id: string, name: string, properties: string, runProperties: string): string =>
  `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:qFormat/>` +
  `<w:pPr>${properties}</w:pPr><w:rPr>${runProperties}</w:rPr></w:style>`;

const STYLES =
  `${XML}<w:styles xmlns:w="${W}">` +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>' +
  '<w:sz w:val="21"/></w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="240" w:lineRule="auto"/></w:pPr>' +
  "</w:pPrDefault></w:docDefaults>" +
  style(
    "Title",
    "Title",
    '<w:jc w:val="center"/><w:spacing w:after="0"/>',
    '<w:b/><w:sz w:val="40"/>',
  ) +
  style(
    "Subtitle",
    "Subtitle",
    '<w:jc w:val="center"/><w:spacing w:after="0"/>',
    '<w:sz w:val="22"/>',
  ) +
  style(
    "Heading1",
    "heading 1",
    '<w:spacing w:before="240" w:after="60"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr>',
    '<w:b/><w:caps/><w:sz w:val="24"/>',
  ) +
  style(
    "Heading2",
    "heading 2",
    '<w:spacing w:before="120" w:after="0"/>',
    '<w:b/><w:sz w:val="22"/>',
  ) +
  style("ListParagraph", "List Paragraph", '<w:spacing w:after="0"/>', "") +
  '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/>' +
  '<w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>' +
  "</w:styles>";

const NUMBERING =
  `${XML}<w:numbering xmlns:w="${W}">` +
  '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/>' +
  `<w:lvlText w:val="\u2022"/><w:lvlJc w:val="left"/>` +
  '<w:pPr><w:ind w:left="360" w:hanging="180"/></w:pPr></w:lvl></w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>';

const CONTENT_TYPES =
  `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
  "</Types>";

const ROOT_RELS =
  `${XML}<Relationships xmlns="${PKG}">` +
  `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>` +
  "</Relationships>";

// A zip stamps every entry with the time it was written unless it is told not
// to, and the earliest a DOS timestamp can say is 1980. Fixing it is what makes
// two files built from one document the same bytes.
const DOS_EPOCH = Date.UTC(1980, 0, 1);

export function toDocx(document: ResumeDocument): Uint8Array<ArrayBuffer> {
  const links = new Links();
  const body = toBlocks(document)
    .map((one) => paragraph(one, links))
    .join("");

  const documentXml = `${XML}<w:document xmlns:w="${W}" xmlns:r="${REL}"><w:body>${body}${SECTION}</w:body></w:document>`;

  const documentRels =
    `${XML}<Relationships xmlns="${PKG}">` +
    `<Relationship Id="rStyles" Type="${REL}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rNumbering" Type="${REL}/numbering" Target="numbering.xml"/>` +
    `${links.relationships()}</Relationships>`;

  return zipSync(
    {
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      "_rels/.rels": strToU8(ROOT_RELS),
      "word/document.xml": strToU8(documentXml),
      "word/styles.xml": strToU8(STYLES),
      "word/numbering.xml": strToU8(NUMBERING),
      "word/_rels/document.xml.rels": strToU8(documentRels),
    },
    { mtime: DOS_EPOCH },
  );
}
