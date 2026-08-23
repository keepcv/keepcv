// JSON Resume v1.0.0, written out rather than generated. It is somebody else's
// contract, so a copy that cannot change under us is the point; every field is
// optional there, and is here too.
export interface JsonResumeLocation {
  address?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  region?: string;
}

export interface JsonResumeProfile {
  network: string;
  username?: string;
  url?: string;
}

export interface JsonResumeBasics {
  name?: string;
  label?: string;
  image?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: JsonResumeLocation;
  profiles?: JsonResumeProfile[];
}

interface Dated {
  startDate?: string;
  endDate?: string;
}

export interface JsonResumeWork extends Dated {
  name?: string;
  location?: string;
  description?: string;
  position?: string;
  url?: string;
  summary?: string;
  highlights?: string[];
}

export interface JsonResumeVolunteer extends Dated {
  organization?: string;
  position?: string;
  url?: string;
  summary?: string;
  highlights?: string[];
}

export interface JsonResumeEducation extends Dated {
  institution?: string;
  url?: string;
  area?: string;
  studyType?: string;
  score?: string;
  courses?: string[];
}

export interface JsonResumeAward {
  title?: string;
  date?: string;
  awarder?: string;
  summary?: string;
}

export interface JsonResumeCertificate {
  name?: string;
  date?: string;
  issuer?: string;
  url?: string;
}

export interface JsonResumePublication {
  name?: string;
  publisher?: string;
  releaseDate?: string;
  url?: string;
  summary?: string;
}

export interface JsonResumeSkill {
  name?: string;
  level?: string;
  keywords?: string[];
}

export interface JsonResumeLanguage {
  language?: string;
  fluency?: string;
}

export interface JsonResumeProject extends Dated {
  name?: string;
  description?: string;
  highlights?: string[];
  keywords?: string[];
  url?: string;
  roles?: string[];
  entity?: string;
  type?: string;
}

export interface JsonResumeInterest {
  name?: string;
  keywords?: string[];
}

export interface JsonResumeReference {
  name?: string;
  reference?: string;
}

export interface JsonResumeMeta {
  canonical?: string;
  version?: string;
  lastModified?: string;
}

export interface JsonResume {
  $schema?: string;
  basics?: JsonResumeBasics;
  work?: JsonResumeWork[];
  volunteer?: JsonResumeVolunteer[];
  education?: JsonResumeEducation[];
  awards?: JsonResumeAward[];
  certificates?: JsonResumeCertificate[];
  publications?: JsonResumePublication[];
  skills?: JsonResumeSkill[];
  languages?: JsonResumeLanguage[];
  interests?: JsonResumeInterest[];
  references?: JsonResumeReference[];
  projects?: JsonResumeProject[];
  meta?: JsonResumeMeta;
}

export const JSON_RESUME_SCHEMA =
  "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json";
