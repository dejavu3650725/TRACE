const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:01[016789])[- .]?\d{3,4}[- .]?\d{4}/;
const ROSTER_FIELD_PATTERN = /(?:학생\s*(?:이름|성명|번호|명단)|학번|교사\s*(?:이메일|메일)|student_(?:name|number|id)|teacher_(?:email|id)|class_(?:name|id)|auth_user_id)/i;
const KOREAN_SURNAME = "(?:김|이|박|최|정|강|조|윤|장|임|한|오|서|신|권|황|안|송|전|홍|유|고|문|양|손|배|백|허|남|심|노|하|곽|성|차|주|우|구|민|진|엄|채|원|천|방|공|현|함|변|염|여|추|도|소|석|선|설|마|길|연|위|표|명|기|반|왕|금|옥|육|인|맹|제|모|남궁|황보)";
const NAMED_STUDENT_PATTERN = new RegExp(
  `(?:${KOREAN_SURNAME}[가-힣]{1,2}\\s*학생|학생\\s*(?:(?:이름|성명)\\s*[:：]?|[:：])\\s*${KOREAN_SURNAME}[가-힣]{1,2})`,
);
const NUMBERED_STUDENT_PATTERN = /\b\d{1,5}\s*번\s*학생/;
const ROSTER_ROW_PATTERN = /(?:^|\n)\s*\d{1,5}\s*[,\t]\s*[가-힣]{2,5}(?:\s|$)/;
const CLASS_DISPLAY_NAME_PATTERN = /\d{1,2}\s*학년\s*\d{1,2}\s*반/;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const GOOGLE_ACCOUNT_PATTERN = /(?:google|구글)\s*(?:account|계정|profile|프로필)/i;

const PROHIBITED_KEY_NAMES = new Set([
  "student",
  "studentid",
  "studentname",
  "studentnumber",
  "otherstudents",
  "teacherid",
  "teacheremail",
  "authuserid",
  "googleaccount",
  "googleprofile",
  "roster",
  "fullroster",
  "classid",
  "classname",
  "classdisplayname",
  "classcode",
  "submissionid",
  "artifactid",
]);

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isProhibitedAiKey(value: string): boolean {
  return PROHIBITED_KEY_NAMES.has(normalizedKey(value));
}

/** Conservative text guard used at the final server boundary before a Provider request. */
export function containsProhibitedAiContext(value: string): boolean {
  return [
    EMAIL_PATTERN,
    PHONE_PATTERN,
    ROSTER_FIELD_PATTERN,
    NAMED_STUDENT_PATTERN,
    NUMBERED_STUDENT_PATTERN,
    ROSTER_ROW_PATTERN,
    CLASS_DISPLAY_NAME_PATTERN,
    UUID_PATTERN,
    GOOGLE_ACCOUNT_PATTERN,
  ].some((pattern) => pattern.test(value));
}
