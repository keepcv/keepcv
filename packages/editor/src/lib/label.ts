// The schema's vocabularies are lower case because they are stored values. A
// select is the one place a reader sees them.
export function sentenceCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1).replaceAll("_", " ")}`;
}

// Both forms spelled out: the resume list counts entries, not entrys.
export function counted(count: number, singular: string, plural: string): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}
