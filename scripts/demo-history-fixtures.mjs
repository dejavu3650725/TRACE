export const LIVE_DEMO_STUDENT_NUMBERS = new Set([4, 20]);

export const DEMO_HISTORY_ACTIVITIES = {
  a1: {
    key: "a1",
    lesson: 1,
    titleIncludes: "문단의 중심 찾기",
    subject: "국어",
    domain: "읽기",
    standardId: "4국02-02",
    activityCode: "KOR-03-02-02-001",
    sourceFile: "sample_results_a1.pdf",
    sourceChecksum: "d4d646eeed604dbde4560911efa05be4a9f4bf7afb42e818b4f88b50c161c5f0",
    previousKey: null,
    questionIds: ["Q1", "Q2", "Q3"],
  },
  a2: {
    key: "a2",
    lesson: 2,
    titleIncludes: "문단의 짜임 알아보기",
    subject: "국어",
    domain: "읽기",
    standardId: "4국02-02",
    activityCode: "KOR-03-02-02-002",
    sourceFile: "sample_results_a2.pdf",
    sourceChecksum: "917a2be66cb439686f2166c687e9c650cae5fb0460b17080987b2aee3d4ad9fe",
    previousKey: "a1",
    questionIds: ["Q1"],
  },
  a3: {
    key: "a3",
    lesson: 3,
    titleIncludes: "문단 완성하기",
    subject: "국어",
    domain: "읽기",
    standardId: "4국02-02",
    activityCode: "KOR-03-02-02-003",
    sourceFile: "sample_results_a3.pdf",
    sourceChecksum: "6204e7093605772fcdbd635cc489feebc4845e9d38d4227c3dde464be32043db",
    previousKey: "a2",
    questionIds: ["Q1", "Q2", "Q3"],
  },
};

const PROFILE_BY_STUDENT_NUMBER = new Map([
  ...[1, 2, 5, 8, 11, 14].map((number) => [number, "consistent"]),
  ...[3, 6, 9, 12, 15].map((number) => [number, "improving"]),
  ...[7, 10, 13, 16].map((number) => [number, "variable"]),
  ...[17, 18, 19].map((number) => [number, "support"]),
]);

export function syntheticProfileForStudent(studentNumber) {
  if (LIVE_DEMO_STUDENT_NUMBERS.has(studentNumber)) return null;
  return PROFILE_BY_STUDENT_NUMBER.get(studentNumber) ?? null;
}

function question(questionId, responseType, response) {
  return { question_id: questionId, response_type: responseType, response };
}

function variant(studentNumber, values) {
  return values[studentNumber % values.length];
}

function a1Input(studentNumber, profile) {
  const correctPairs = ["(1)-(나)", "(2)-(가)", "(3)-(다)"];
  if (profile === "consistent") {
    return [
      question("Q1", "short_text", { raw_text: "중심 문장 / 뒷받침 문장 / 문단" }),
      question("Q2", "matching", { pairs: correctPairs }),
      question("Q3", "circle", { selected_options: ["(1) ③", "(2) ②"] }),
    ];
  }
  if (profile === "improving") {
    return [
      question("Q1", "short_text", { raw_text: "중심 문장 / 뒷받침 문장 / 문단" }),
      question("Q2", "matching", { pairs: ["(1)-(나)", "(2)-(가)", "(3)-(나)"] }),
      question("Q3", "circle", { selected_options: ["(1) ③", variant(studentNumber, ["(2) ①", "(2) ②"])] }),
    ];
  }
  if (profile === "variable") {
    return [
      question("Q1", "short_text", { raw_text: variant(studentNumber, ["중심 문장 / 문단 / 뒷받침 문장", "중심 문장 / 뒷받침 문장 / 문단"]) }),
      question("Q2", "matching", { pairs: variant(studentNumber, [["(1)-(나)", "(2)-(다)"], ["(1)-(가)", "(3)-(다)"]]) }),
      question("Q3", "circle", { selected_options: variant(studentNumber, [["(1) ①", "(2) ②"], ["(1) ③", "(2) ③"]]) }),
    ];
  }
  return [
    question("Q1", "short_text", { raw_text: variant(studentNumber, ["문장 / 중심 / 문단", "중심 문장 / 잘 모르겠음"]) }),
    question("Q2", "matching", { marks: variant(studentNumber, [["(1)-(가)"], ["연결선 1개"]]) }),
    question("Q3", "circle", studentNumber === 18 ? { is_blank: true } : { selected_options: ["(1) ①"] }),
  ];
}

const CENTRAL_SENTENCES = [
  "학교 도서관은 우리에게 많은 도움을 주는 소중한 곳입니다.",
  "이처럼 일찍 일어나는 습관은 우리에게 좋은 점이 많습니다.",
  "운동은 우리 몸과 마음을 건강하게 해 줍니다.",
  "이렇게 우리나라는 사계절의 모습이 각각 다르고 아름답습니다.",
  "가족을 돕는 방법은 여러 가지가 있습니다.",
];

function a2Input(studentNumber, profile) {
  let selected;
  if (profile === "consistent") selected = CENTRAL_SENTENCES;
  else if (profile === "improving") selected = [
    ...CENTRAL_SENTENCES.slice(0, 4),
    "자기가 가지고 논 장난감을 스스로 정리하는 것도 좋은 방법입니다.",
  ];
  else if (profile === "variable") selected = variant(studentNumber, [
    [CENTRAL_SENTENCES[0], CENTRAL_SENTENCES[2], CENTRAL_SENTENCES[4]],
    [CENTRAL_SENTENCES[0], "학교에 갈 준비를 꼼꼼하게 해서 준비물을 빠뜨리지 않습니다.", CENTRAL_SENTENCES[3]],
  ]);
  else selected = variant(studentNumber, [
    ["도서관에서는 여러 종류의 책을 읽을 수 있습니다."],
    [CENTRAL_SENTENCES[2], "수건이나 양말 같은 작은 빨래를 갤 수도 있습니다."],
    [],
  ]);

  return [question("Q1", "underline", selected.length > 0
    ? { underlined_sentences: selected }
    : { is_blank: true })];
}

function a3Input(studentNumber, profile) {
  const supportSets = {
    consistent: variant(studentNumber, [
      ["우리 반 친구들은 서로 어려운 일을 도와줍니다.", "발표할 때 친구의 말을 끝까지 잘 들어 줍니다."],
      ["우리 반은 함께 즐겁게 놉니다.", "교실을 깨끗하게 사용하려고 모두 노력합니다."],
    ]),
    improving: variant(studentNumber, [
      ["우리 반 친구들은 서로 잘 도와줍니다.", "함께 즐겁게 놉니다."],
      ["친구들이 발표를 잘 들어 줍니다.", "교실을 함께 정리합니다."],
    ]),
    variable: variant(studentNumber, [
      ["우리 반은 친구가 많습니다.", "쉬는 시간에 함께 놉니다."],
      ["친구들이 서로 도와줍니다.", "우리 반은 즐겁습니다."],
    ]),
    support: variant(studentNumber, [
      ["친구가 있습니다.", "같이 놉니다."],
      ["우리 반은 좋습니다.", "재미있습니다."],
    ]),
  };
  const supports = supportSets[profile];
  const paragraph = profile === "support" && studentNumber === 18
    ? "우리 반에는 좋은 점이 많습니다. 친구가 있습니다."
    : ["우리 반에는 좋은 점이 많습니다.", ...supports].join(" ");
  const checked = profile === "consistent"
    ? ["중심 문장이 들어 있나요?", "알맞은 뒷받침 문장이 있나요?", "문장이 자연스럽게 이어지나요?"]
    : profile === "improving"
      ? ["중심 문장이 들어 있나요?", "알맞은 뒷받침 문장이 있나요?"]
      : ["중심 문장이 들어 있나요?"];

  return [
    question("Q1", "long_text", { raw_text: supports.join(" / ") }),
    question("Q2", "long_text", { raw_text: paragraph }),
    question("Q3", "checkbox", { selected_options: checked }),
  ];
}

export function buildSyntheticStructuredInput(activityKey, studentNumber) {
  const profile = syntheticProfileForStudent(studentNumber);
  if (!profile) throw new Error(`Student ${studentNumber} is reserved for the real PDF path`);
  if (!Object.hasOwn(DEMO_HISTORY_ACTIVITIES, activityKey)) throw new Error(`Unsupported demo Activity: ${activityKey}`);

  const questions = activityKey === "a1"
    ? a1Input(studentNumber, profile)
    : activityKey === "a2"
      ? a2Input(studentNumber, profile)
      : a3Input(studentNumber, profile);

  return { schema_version: "1", questions };
}
