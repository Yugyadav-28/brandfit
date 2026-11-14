/**
 * Test script for Team Activity calculation (lib/insights/teamActivity.ts).
 * Run with: npx tsx scripts/test-teamactivity.ts or node scripts/test-teamactivity.ts
 */

import type {
  Member,
  Submission,
  Version,
  Finding,
} from "../lib/insights/teamActivity";

const teamActivityPath = "../lib/insights/teamActivity.ts";
const { calculateTeamActivity } = (await import(teamActivityPath)) as typeof import("../lib/insights/teamActivity");

// ─── Made-up test data ────────────────────────────────────────────────────────

const members: Member[] = [
  {
    user_id: "u-alice",
    role: "employee",
    display_name: "Alice Smith",
    email: "alice@example.com",
  },
  {
    user_id: "u-bob",
    role: "employee",
    display_name: "Bob Jones",
    email: "bob@example.com",
  },
  {
    user_id: "u-carol",
    role: "reviewer",
    display_name: "Carol Danvers",
    email: "carol@example.com",
  },
  {
    user_id: "u-dave",
    role: "employer",
    display_name: "Dave Employer",
    email: "dave@example.com",
  },
];

const submissions: Submission[] = [
  // Alice: 2 posts
  { id: "sub-1", author_id: "u-alice" },
  { id: "sub-2", author_id: "u-alice" },
  // Carol (reviewer): 1 post
  { id: "sub-3", author_id: "u-carol" },
  // Bob: 0 posts
  // Dave: 0 posts
];

const versions: Version[] = [
  // sub-1 has 2 versions
  { id: "v-1-1", submission_id: "sub-1", version_no: 1 },
  { id: "v-1-2", submission_id: "sub-1", version_no: 2 },

  // sub-2 has 1 version
  { id: "v-2-1", submission_id: "sub-2", version_no: 1 },

  // sub-3 has 1 version
  { id: "v-3-1", submission_id: "sub-3", version_no: 1 },
];

const findings: Finding[] = [
  // sub-1, version 1 (FIRST version)
  { version_id: "v-1-1", rule_code: "T-1", decision: "accepted" },
  { version_id: "v-1-1", rule_code: "C-2", decision: "rejected" },

  // sub-1, version 2 (SECOND version - must be IGNORED in first-version stats!)
  { version_id: "v-1-2", rule_code: "W-1", decision: "accepted" },

  // sub-2, version 1 (FIRST version)
  { version_id: "v-2-1", rule_code: "T-1", decision: "edited" },
  { version_id: "v-2-1", rule_code: "FA-1", decision: "pending" },

  // sub-3, version 1 (FIRST version, Carol)
  { version_id: "v-3-1", rule_code: "C-1", decision: "accepted" },
  { version_id: "v-3-1", rule_code: "C-1", decision: "accepted" }, // duplicate code in same post
];

// ─── Run calculation ──────────────────────────────────────────────────────────

console.log("=== Running Team Activity Calculation Test ===\n");

const results = calculateTeamActivity(members, submissions, versions, findings);

console.log("Results summary:");
console.table(results);

// ─── Hand-checked assertions ──────────────────────────────────────────────────

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

// 1. Members included
assert(
  results.length === 3,
  `Expected 3 members (Alice, Carol, Bob), got ${results.length}`,
);
assert(
  results.some((r) => r.user_id === "u-alice"),
  "Alice (employee with 2 posts) must be included",
);
assert(
  results.some((r) => r.user_id === "u-bob"),
  "Bob (employee with 0 posts) must be included",
);
assert(
  results.some((r) => r.user_id === "u-carol"),
  "Carol (reviewer with 1 post) must be included",
);
assert(
  !results.some((r) => r.user_id === "u-dave"),
  "Dave (employer with 0 posts) must be excluded",
);

// 2. Alice's stats
const alice = results.find((r) => r.user_id === "u-alice")!;
assert(alice.display_name === "Alice Smith", "Alice display name matches");
assert(alice.submissions === 2, `Alice submissions: expected 2, got ${alice.submissions}`);
assert(
  alice.total_findings === 4,
  `Alice total findings (first versions only): expected 4, got ${alice.total_findings}`,
);
assert(alice.accepted === 1, `Alice accepted: expected 1, got ${alice.accepted}`);
assert(alice.edited === 1, `Alice edited: expected 1, got ${alice.edited}`);
assert(alice.rejected === 1, `Alice rejected: expected 1, got ${alice.rejected}`);
assert(
  alice.repeated_mistakes === 1,
  `Alice repeated mistakes (T-1 in sub-1 & sub-2): expected 1, got ${alice.repeated_mistakes}`,
);

// 3. Bob's stats (employee with 0 posts)
const bob = results.find((r) => r.user_id === "u-bob")!;
assert(bob.display_name === "Bob Jones", "Bob display name matches");
assert(bob.submissions === 0, `Bob submissions: expected 0, got ${bob.submissions}`);
assert(bob.total_findings === 0, `Bob total findings: expected 0, got ${bob.total_findings}`);
assert(bob.repeated_mistakes === 0, `Bob repeated mistakes: expected 0, got ${bob.repeated_mistakes}`);

// 4. Carol's stats (reviewer with 1 post)
const carol = results.find((r) => r.user_id === "u-carol")!;
assert(carol.display_name === "Carol Danvers", "Carol display name matches");
assert(carol.submissions === 1, `Carol submissions: expected 1, got ${carol.submissions}`);
assert(carol.total_findings === 2, `Carol total findings: expected 2, got ${carol.total_findings}`);
assert(carol.accepted === 2, `Carol accepted: expected 2, got ${carol.accepted}`);
assert(carol.edited === 0, `Carol edited: expected 0, got ${carol.edited}`);
assert(carol.rejected === 0, `Carol rejected: expected 0, got ${carol.rejected}`);
assert(
  carol.repeated_mistakes === 0,
  `Carol repeated mistakes (same code in 1 post only): expected 0, got ${carol.repeated_mistakes}`,
);

// 5. Sorting: highest submissions first (Alice: 2, Carol: 1, Bob: 0)
assert(results[0].user_id === "u-alice", "1st row is Alice (2 posts)");
assert(results[1].user_id === "u-carol", "2nd row is Carol (1 post)");
assert(results[2].user_id === "u-bob", "3rd row is Bob (0 posts)");

console.log("\n🎉 All Team Activity assertions passed successfully!");
