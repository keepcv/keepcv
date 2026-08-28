// RenderCV's input file, written out rather than generated. A date is a string
// or a year as a number there, and the three header fields each take one value
// or a list of them.
export type RenderCvDate = string | number;
export type RenderCvOneOrMany = string | string[];

export interface RenderCvSocialNetwork {
  network?: string;
  username?: string;
}

export interface RenderCvCustomConnection {
  fontawesome_icon?: string;
  placeholder?: string;
  url?: string;
}

interface Dated {
  date?: RenderCvDate;
  start_date?: RenderCvDate;
  end_date?: RenderCvDate;
}

interface Described {
  location?: string;
  summary?: string;
  highlights?: string[];
}

export interface RenderCvEducationEntry extends Dated, Described {
  institution?: string;
  area?: string;
  degree?: string;
}

export interface RenderCvExperienceEntry extends Dated, Described {
  company?: string;
  position?: string;
}

export interface RenderCvNormalEntry extends Dated, Described {
  name?: string;
}

export interface RenderCvPublicationEntry {
  title?: string;
  authors?: string[];
  summary?: string;
  doi?: string;
  url?: string;
  journal?: string;
  date?: RenderCvDate;
}

export interface RenderCvOneLineEntry {
  label?: string;
  details?: string;
}

export interface RenderCvBulletEntry {
  bullet?: string;
}

export interface RenderCvNumberedEntry {
  number?: string;
}

export interface RenderCvReversedNumberedEntry {
  reversed_number?: string;
}

export type RenderCvEntry =
  | string
  | RenderCvEducationEntry
  | RenderCvExperienceEntry
  | RenderCvNormalEntry
  | RenderCvPublicationEntry
  | RenderCvOneLineEntry
  | RenderCvBulletEntry
  | RenderCvNumberedEntry
  | RenderCvReversedNumberedEntry;

// Keys are the headings as they print, which is the only name a section has.
export interface RenderCvCv {
  name?: string;
  headline?: string;
  location?: string;
  email?: RenderCvOneOrMany;
  phone?: RenderCvOneOrMany;
  website?: RenderCvOneOrMany;
  photo?: string;
  social_networks?: RenderCvSocialNetwork[];
  custom_connections?: RenderCvCustomConnection[];
  // Nullable because this interface is a cast over parsed YAML rather than a
  // schema, and `Experience:` with nothing under it parses as null.
  sections?: Record<string, RenderCvEntry[] | null>;
}

// `design`, `locale` and `settings` are how the file is rendered rather than
// what it says, so nothing here reads them.
export interface RenderCvFile {
  cv?: RenderCvCv;
}
