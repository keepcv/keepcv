// Reactive Resume's export, written out rather than generated. Every field is
// optional here even though the schema requires most of them: a file on disk was
// written by whichever version the user had, and a reader that throws on a
// missing key reads nothing rather than most of it.
export interface ReactiveResumeUrl {
  url?: string;
  label?: string;
}

export interface ReactiveResumeCustomField {
  icon?: string;
  text?: string;
  link?: string;
}

export interface ReactiveResumeBasics {
  name?: string;
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  website?: ReactiveResumeUrl;
  customFields?: ReactiveResumeCustomField[];
}

interface Item {
  id?: string;
  // The user wrote it and chose not to print it. Nothing here skips it.
  hidden?: boolean;
}

export interface ReactiveResumeProfile extends Item {
  network?: string;
  username?: string;
  website?: ReactiveResumeUrl;
}

export interface ReactiveResumeRole {
  position?: string;
  period?: string;
  description?: string;
}

export interface ReactiveResumeExperience extends Item {
  company?: string;
  position?: string;
  location?: string;
  period?: string;
  website?: ReactiveResumeUrl;
  description?: string;
  roles?: ReactiveResumeRole[];
}

export interface ReactiveResumeEducation extends Item {
  school?: string;
  degree?: string;
  area?: string;
  grade?: string;
  location?: string;
  period?: string;
  website?: ReactiveResumeUrl;
  description?: string;
}

export interface ReactiveResumeProject extends Item {
  name?: string;
  period?: string;
  website?: ReactiveResumeUrl;
  description?: string;
}

export interface ReactiveResumeSkill extends Item {
  name?: string;
  proficiency?: string;
  level?: number;
  keywords?: string[];
}

export interface ReactiveResumeLanguage extends Item {
  language?: string;
  fluency?: string;
  level?: number;
}

export interface ReactiveResumeInterest extends Item {
  name?: string;
  keywords?: string[];
}

export interface ReactiveResumeAward extends Item {
  title?: string;
  awarder?: string;
  date?: string;
  website?: ReactiveResumeUrl;
  description?: string;
}

export interface ReactiveResumeCertification extends Item {
  title?: string;
  issuer?: string;
  date?: string;
  website?: ReactiveResumeUrl;
  description?: string;
}

export interface ReactiveResumePublication extends Item {
  title?: string;
  publisher?: string;
  date?: string;
  website?: ReactiveResumeUrl;
  description?: string;
}

export interface ReactiveResumeVolunteer extends Item {
  organization?: string;
  location?: string;
  period?: string;
  website?: ReactiveResumeUrl;
  description?: string;
}

export interface ReactiveResumeReference extends Item {
  name?: string;
  position?: string;
  phone?: string;
  website?: ReactiveResumeUrl;
  description?: string;
}

export interface ReactiveResumeProse extends Item {
  recipient?: string;
  content?: string;
}

export interface ReactiveResumeSection<T> {
  title?: string;
  columns?: number;
  hidden?: boolean;
  items?: T[];
}

export interface ReactiveResumeSections {
  profiles?: ReactiveResumeSection<ReactiveResumeProfile>;
  experience?: ReactiveResumeSection<ReactiveResumeExperience>;
  education?: ReactiveResumeSection<ReactiveResumeEducation>;
  projects?: ReactiveResumeSection<ReactiveResumeProject>;
  skills?: ReactiveResumeSection<ReactiveResumeSkill>;
  languages?: ReactiveResumeSection<ReactiveResumeLanguage>;
  interests?: ReactiveResumeSection<ReactiveResumeInterest>;
  awards?: ReactiveResumeSection<ReactiveResumeAward>;
  certifications?: ReactiveResumeSection<ReactiveResumeCertification>;
  publications?: ReactiveResumeSection<ReactiveResumePublication>;
  volunteer?: ReactiveResumeSection<ReactiveResumeVolunteer>;
  references?: ReactiveResumeSection<ReactiveResumeReference>;
}

// A custom section is a heading over items of one of the same declared kinds,
// which is why its `type` is what decides how it is read.
export interface ReactiveResumeCustomSection {
  id?: string;
  title?: string;
  hidden?: boolean;
  type?: string;
  items?: unknown[];
}

export interface ReactiveResumeSummary {
  title?: string;
  hidden?: boolean;
  content?: string;
}

export interface ReactiveResume {
  basics?: ReactiveResumeBasics;
  summary?: ReactiveResumeSummary;
  sections?: ReactiveResumeSections;
  customSections?: ReactiveResumeCustomSection[];
}
