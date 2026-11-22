export const scenes = {
  overview: [
    "Start in your career store.",
    "The overview shows what is already available to build with.",
    "01 / START",
  ],
  journeyRecord: [
    "Add context to a role.",
    "An experience record keeps the work, dates and reusable Points together.",
    "02 / CAPTURE",
  ],
  journeyTemplates: [
    "Compare layouts with your own content.",
    "Choose a template to preview the same tailored resume in a different layout.",
    "05 / DESIGN",
  ],
  journeyApply: [
    "Apply the layout you want.",
    "Classic changes the page design while keeping the selected Points and skills.",
    "05 / DESIGN",
  ],
  journeyExport: [
    "Export the finished resume as PDF.",
    "Use Export PDF from the Design view to keep the layout you just chose.",
    "06 / EXPORT",
  ],
  import: [
    "Bring the work you've already done.",
    "Import PDF, DOCX, JSON Resume, Reactive Resume or RenderCV. Review before adding.",
    "02 / CAPTURE",
  ],
  profile: [
    "Write your introduction once.",
    "Identity, contact details and a reusable professional summary.",
    "02 / CAPTURE",
  ],
  records: [
    "Keep the whole story.",
    "Roles, education, projects, skills and more. Nothing trimmed to fit a page.",
    "01 / CAPTURE",
  ],
  record: [
    "Give every record its context.",
    "Dates, links, custom fields and reusable Points stay connected.",
    "01 / CAPTURE",
  ],
  wording: [
    "Find the words. Keep the alternatives.",
    "Standard, short, detailed and role-specific wording - with revision history.",
    "02 / REUSE",
  ],
  evidence: [
    "Keep the proof private.",
    "Structured metrics show impact. Supporting evidence stays out of resumes.",
    "02 / REUSE",
  ],
  tags: [
    "Organize it your way.",
    "Shared tags, custom section headings and saved filters.",
    "02 / REUSE",
  ],
  search: [
    "Find the right Point, fast.",
    "Search your store and jump between screens from the command palette.",
    "02 / REUSE",
  ],
  roles: [
    "Start with the right emphasis.",
    "Role profiles reuse groups of tags to add matching records and Points.",
    "02 / REUSE",
  ],
  compose: [
    "Choose what belongs in the draft.",
    "Show or hide a Point and watch the paper preview update beside it.",
    "03 / COMPOSE",
  ],
  reorder: [
    "Put your strongest work first.",
    "Drag sections, entries and Points. Keyboard ordering is available too.",
    "03 / COMPOSE",
  ],
  target: [
    "Make the job target concrete.",
    "Compare posting terms with selected content and review weaker matches.",
    "03 / COMPOSE",
  ],
  templates: [
    "Choose a design with confidence.",
    "Preview visual and creative HTML templates before applying one.",
    "04 / DESIGN",
  ],
  builder: [
    "Make the template your own.",
    "Typography, color, spacing and layout. Save a reusable design.",
    "05 / DESIGN",
  ],
  html: [
    "Go further with HTML.",
    "Edit source files, styles and assets in the template workspace.",
    "04 / DESIGN",
  ],
  design: [
    "Check the original draft's page fit.",
    "Live paper preview, fit controls, page budgeting and readability checks.",
    "05 / DESIGN",
  ],
  export: [
    "Take your resume with you.",
    "PDF, HTML, Word, JSON Resume, LaTeX, Typst - or a personal web page.",
    "05 / KEEP",
  ],
  history: [
    "Compare versions of the original draft.",
    "Versions preserve wording. Star snapshots, compare changes and restore selections.",
    "07 / HISTORY",
  ],
  backup: [
    "Your data stays yours.",
    "Download a full backup, restore it, and run KeepCV locally.",
    "05 / KEEP",
  ],
};
export const assistantScenes = {
  assistantManage: [
    "Update your career store with Assistant.",
    "Review a proposed tag and Point, then accept the changes.",
  ],
  assistantJob: [
    "Start with a job posting link.",
    "Paste the URL in Assistant and turn on Web search for the request.",
  ],
  assistantReview: [
    "Review the proposed resume.",
    "Inspect what Assistant selected and accept when you are ready.",
  ],
  assistantResult: [
    "Open the tailored resume.",
    "Review the selected Points, skills and live preview in the editor.",
  ],
};
for (const [name, copy] of Object.entries(assistantScenes)) {
  scenes[name] = [...copy, "ASSISTANT / DEMO RESPONSES"];
}
