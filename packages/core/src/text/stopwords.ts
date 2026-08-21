// Two lists rather than one, because they are wrong in different ways: the
// function words are closed and settled, and the posting boilerplate is a
// judgement that gets revisited whenever a real posting reads badly.

const FUNCTION_WORDS = `
a about above after again against all along also am among amongst an and any
are around as at be because been before behind being below beside besides
between beyond both but by can cannot could despite did do does doing down
during each either every except few for from further had has have having he
her here hers him his how however i if in inside instead into is it its itself
just least less may me might more most much must my near neither no nor not
now of off on once one only or other others our ours out outside over own per
same several she should since so some such than that the their theirs them
then there these they this those through throughout to too toward towards
under unless until up upon us various versus very via was we were what when
whenever where whereas wherever whether which while who whom whose why will
with within would yet you your yours
`;

// Words a posting spends most of its length on that no resume could answer by
// carrying them. Dropping these is what leaves the terms worth ranking.
const POSTING_WORDS = `
ability able across applicant applicants application apply background based
benefit benefits candidate candidates care cares career closely colleague
colleagues company competitive culture day days deal deep describe describes
description desirable detail drive drives employee employees employer
employment environment equal essential etc excellent experience experienced
familiar familiarity fast field focus full generous get good great group help
high highly hire hiring ideal ideally improve include included includes
including individual job join keen knowledge level like look looking love make
many meet member members mission need needs new offer office opportunities
opportunity org organisation organization own owns paced package part partner
partnering people person plus position preferred proven provide qualification
qualifications quality range recruiter related relevant requirement
requirements required responsibilities responsibility role roles run running
salary seeking set similar sit sits skill skills solid strong successful
support sure take task tasks team teams thing things time track understand
understanding use used using value values want way week well work working
world year years
`;

function listed(words: string): string[] {
  return words.split(/\s+/).filter((word) => word !== "");
}

// Held folded and lower case by `stopwords.test.ts`, so a caller folds its own
// word and asks.
export const STOPWORDS: ReadonlySet<string> = new Set([
  ...listed(FUNCTION_WORDS),
  ...listed(POSTING_WORDS),
]);
