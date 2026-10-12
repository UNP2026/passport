export const MAIN_ORGANIZATIONS = [
  { 
    code: "543", 
    name: "Епіцентр", 
    label: "Епіцентр", 
    matchKeywords: ["епіцентр", "эпицентр"] 
  },
  { 
    code: "24169", 
    name: "Світ матраців", 
    label: "Світ матраців", 
    matchKeywords: ["світ матраців", "свит матрацев", "світ матрац", "свит матрац"] 
  },
  { 
    code: "31460", 
    name: "Самураєв", 
    label: "Самураєв", 
    matchKeywords: ["самураєв", "самураев"] 
  },
  { 
    code: "29213", 
    name: "Франкоф", 
    label: "Франкоф", 
    matchKeywords: ["франкоф", "frankof"] 
  },
  { 
    code: "156735", 
    name: "Попков", 
    label: "Попков", 
    matchKeywords: ["попков"] 
  },
];

export const ALL_MAIN_ORG_CODES = MAIN_ORGANIZATIONS.map(m => m.code);

/**
 * Determine which main organization code a given row belongs to (if any)
 */
export function getRowMainOrgCode(d) {
  if (!d) return null;
  const rawCode = String(d.orgCode || "").trim();
  const orgName = String(d.org || "").toLowerCase();
  const pointName = String(d.point || "").toLowerCase();

  // 1. Exact code match
  for (const mo of MAIN_ORGANIZATIONS) {
    if (rawCode === mo.code) return mo.code;
  }

  // 2. Code substring match in orgCode
  for (const mo of MAIN_ORGANIZATIONS) {
    if (rawCode && rawCode.includes(mo.code)) return mo.code;
  }

  // 3. Keyword matches in organization name or point name
  for (const mo of MAIN_ORGANIZATIONS) {
    if (mo.matchKeywords.some(kw => orgName.includes(kw) || pointName.includes(kw))) {
      return mo.code;
    }
  }

  return null;
}
