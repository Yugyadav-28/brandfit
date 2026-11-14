import fs from 'fs';
import path from 'path';

// 1. Polyfill WebSocket for Node (@supabase/supabase-js realtime requirement)
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    (globalThis as any).WebSocket = require('ws');
  } catch {
    // ignore
  }
}

// 2. Ensure 'server-only' and '@/...' resolve when running as a standalone script
const Module = require('module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...args: any[]) {
  if (request === 'server-only') {
    return __filename;
  }
  if (request.startsWith('@/')) {
    const relativePath = path.resolve(process.cwd(), request.slice(2));
    return originalResolve.call(this, relativePath, ...args);
  }
  return originalResolve.call(this, request, ...args);
};

// 3. Load .env.local if present
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabasePublishableKey || !supabaseSecretKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, or SUPABASE_SECRET_KEY');
  process.exit(1);
}

function createAdminClient() {
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function createUserClient() {
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedClient(email: string, password: string) {
  const client = createUserClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Failed to sign in as ${email}: ${error?.message}`);
  }
  return client;
}

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  error?: string;
}

async function main() {
  const admin = createAdminClient();
  const runId = Math.random().toString(36).substring(2, 8);
  const results: TestResult[] = [];

  // Track created IDs for cleanup
  const createdUserIds: string[] = [];
  const createdCompanyIds: string[] = [];

  const credentials = {
    ownerA: { email: `test_owner_a_${runId}@example.com`, password: `Pass_${runId}_A1!` },
    employeeA: { email: `test_emp_a_${runId}@example.com`, password: `Pass_${runId}_A2!` },
    ownerB: { email: `test_owner_b_${runId}@example.com`, password: `Pass_${runId}_B1!` },
    outsider: { email: `test_outsider_${runId}@example.com`, password: `Pass_${runId}_Out!` },
  };

  try {
    // ─── Setup Users ────────────────────────────────────────────────────────
    const userMap: Record<string, string> = {};
    for (const [key, creds] of Object.entries(credentials)) {
      const { data, error } = await admin.auth.admin.createUser({
        email: creds.email,
        password: creds.password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`Failed to create test user ${key}: ${error?.message}`);
      }
      userMap[key] = data.user.id;
      createdUserIds.push(data.user.id);
    }

    // ─── Setup Company A ───────────────────────────────────────────────────
    const joinCodeA = `CA${runId.toUpperCase()}`;
    const { data: compA, error: compAErr } = await admin
      .from('companies')
      .insert({
        name: `Company A ${runId}`,
        join_code: joinCodeA,
        owner_id: userMap.ownerA,
      })
      .select()
      .single();
    if (compAErr || !compA) throw new Error(`Failed to create Company A: ${compAErr?.message}`);
    createdCompanyIds.push(compA.id);

    // Memberships for Company A
    await admin.from('memberships').insert([
      {
        company_id: compA.id,
        user_id: userMap.ownerA,
        role: 'employer',
        display_name: 'Owner A',
      },
      {
        company_id: compA.id,
        user_id: userMap.employeeA,
        role: 'employee',
        display_name: 'Employee A',
      },
    ]);

    // Rule & Fact for Company A
    const { data: ruleA } = await admin
      .from('rules')
      .insert({
        company_id: compA.id,
        code: `R-A-${runId}`,
        category: 'tone',
        title: 'Rule A',
        body: 'Body A',
      })
      .select()
      .single();

    const { data: factA } = await admin
      .from('facts')
      .insert({
        company_id: compA.id,
        code: `F-A-${runId}`,
        statement: 'Fact A Statement',
        source: 'Source A',
      })
      .select()
      .single();

    // Submission 1 in Company A (Owner A's)
    const { data: subOwnerA } = await admin
      .from('submissions')
      .insert({
        company_id: compA.id,
        author_id: userMap.ownerA,
        title: 'Owner A Submission',
        status: 'in_review',
      })
      .select()
      .single();

    const { data: verOwnerA } = await admin
      .from('versions')
      .insert({
        submission_id: subOwnerA.id,
        version_no: 1,
        content: 'Content by owner A',
      })
      .select()
      .single();

    const { data: findingOwnerA } = await admin
      .from('findings')
      .insert({
        version_id: verOwnerA.id,
        source: 'rule_check',
        category: 'tone',
        severity: 'low',
        quoted_text: 'sample',
        explanation: 'Owner A explanation',
        rule_code: `R-A-${runId}`,
        decision: 'pending',
      })
      .select()
      .single();

    await admin.from('comments').insert({
      submission_id: subOwnerA.id,
      author_id: userMap.ownerA,
      body: 'Comment by owner A',
    });

    // Submission 2 in Company A (Employee A's)
    const { data: subEmpA } = await admin
      .from('submissions')
      .insert({
        company_id: compA.id,
        author_id: userMap.employeeA,
        title: 'Employee A Submission',
        status: 'draft',
      })
      .select()
      .single();

    const { data: verEmpA } = await admin
      .from('versions')
      .insert({
        submission_id: subEmpA.id,
        version_no: 1,
        content: 'Content by employee A',
      })
      .select()
      .single();

    const { data: findingEmpA } = await admin
      .from('findings')
      .insert({
        version_id: verEmpA.id,
        source: 'rule_check',
        category: 'tone',
        severity: 'low',
        quoted_text: 'sample',
        explanation: 'Employee A explanation',
        rule_code: `R-A-${runId}`,
        decision: 'pending',
      })
      .select()
      .single();

    await admin.from('comments').insert({
      submission_id: subEmpA.id,
      author_id: userMap.employeeA,
      body: 'Comment by employee A',
    });

    // Audit log for Company A
    await admin.from('audit_log').insert({
      company_id: compA.id,
      user_id: userMap.ownerA,
      action: 'company_created',
      detail: { note: 'Audit A' },
    });

    // ─── Setup Company B ───────────────────────────────────────────────────
    const joinCodeB = `CB${runId.toUpperCase()}`;
    const { data: compB, error: compBErr } = await admin
      .from('companies')
      .insert({
        name: `Company B ${runId}`,
        join_code: joinCodeB,
        owner_id: userMap.ownerB,
      })
      .select()
      .single();
    if (compBErr || !compB) throw new Error(`Failed to create Company B: ${compBErr?.message}`);
    createdCompanyIds.push(compB.id);

    // Memberships for Company B
    await admin.from('memberships').insert({
      company_id: compB.id,
      user_id: userMap.ownerB,
      role: 'employer',
      display_name: 'Owner B',
    });

    // Rule & Fact for Company B
    const { data: ruleB } = await admin
      .from('rules')
      .insert({
        company_id: compB.id,
        code: `R-B-${runId}`,
        category: 'tone',
        title: 'Rule B',
        body: 'Body B',
      })
      .select()
      .single();

    const { data: factB } = await admin
      .from('facts')
      .insert({
        company_id: compB.id,
        code: `F-B-${runId}`,
        statement: 'Fact B Statement',
        source: 'Source B',
      })
      .select()
      .single();

    // Submission in Company B (Owner B's)
    const { data: subB } = await admin
      .from('submissions')
      .insert({
        company_id: compB.id,
        author_id: userMap.ownerB,
        title: 'Owner B Submission',
        status: 'in_review',
      })
      .select()
      .single();

    const { data: verB } = await admin
      .from('versions')
      .insert({
        submission_id: subB.id,
        version_no: 1,
        content: 'Content by owner B',
      })
      .select()
      .single();

    const { data: findingB } = await admin
      .from('findings')
      .insert({
        version_id: verB.id,
        source: 'rule_check',
        category: 'tone',
        severity: 'low',
        quoted_text: 'sample',
        explanation: 'Owner B explanation',
        rule_code: `R-B-${runId}`,
        decision: 'pending',
      })
      .select()
      .single();

    const { data: commentB } = await admin
      .from('comments')
      .insert({
        submission_id: subB.id,
        author_id: userMap.ownerB,
        body: 'Comment by owner B',
      })
      .select()
      .single();

    // Audit log for Company B
    await admin.from('audit_log').insert({
      company_id: compB.id,
      user_id: userMap.ownerB,
      action: 'company_created',
      detail: { note: 'Audit B' },
    });

    // ─── Authenticate Client Connections ────────────────────────────────────
    const clientEmpA = await getAuthenticatedClient(credentials.employeeA.email, credentials.employeeA.password);
    const clientOwnerA = await getAuthenticatedClient(credentials.ownerA.email, credentials.ownerA.password);
    const clientOutsider = await getAuthenticatedClient(credentials.outsider.email, credentials.outsider.password);
    const clientAnon = createUserClient();

    // ─── Test 1: employeeA can read company A's rules and facts ──────────────
    try {
      const { data: rulesData, error: rulesErr } = await clientEmpA
        .from('rules')
        .select('*')
        .eq('company_id', compA.id);
      const { data: factsData, error: factsErr } = await clientEmpA
        .from('facts')
        .select('*')
        .eq('company_id', compA.id);

      const hasRule = (rulesData || []).some((r: any) => r.id === ruleA.id);
      const hasFact = (factsData || []).some((f: any) => f.id === factA.id);
      const passed = !rulesErr && !factsErr && hasRule && hasFact;
      results.push({
        num: 1,
        name: "employeeA can read company A's rules and facts",
        passed,
      });
    } catch (err: any) {
      results.push({
        num: 1,
        name: "employeeA can read company A's rules and facts",
        passed: false,
        error: err?.message,
      });
    }

    // ─── Test 2: employeeA cannot read company B's data (zero rows) ──────────
    try {
      const [
        { data: rB },
        { data: fB },
        { data: sB },
        { data: vB },
        { data: findB },
        { data: commB },
        { data: aB },
      ] = await Promise.all([
        clientEmpA.from('rules').select('*').eq('company_id', compB.id),
        clientEmpA.from('facts').select('*').eq('company_id', compB.id),
        clientEmpA.from('submissions').select('*').eq('company_id', compB.id),
        clientEmpA.from('versions').select('*').eq('id', verB.id),
        clientEmpA.from('findings').select('*').eq('id', findingB.id),
        clientEmpA.from('comments').select('*').eq('id', commentB.id),
        clientEmpA.from('audit_log').select('*').eq('company_id', compB.id),
      ]);

      const passed =
        (rB?.length ?? 0) === 0 &&
        (fB?.length ?? 0) === 0 &&
        (sB?.length ?? 0) === 0 &&
        (vB?.length ?? 0) === 0 &&
        (findB?.length ?? 0) === 0 &&
        (commB?.length ?? 0) === 0 &&
        (aB?.length ?? 0) === 0;

      results.push({
        num: 2,
        name: "employeeA cannot read company B's rules, facts, submissions, versions, findings, comments or audit log (zero rows)",
        passed,
      });
    } catch (err: any) {
      results.push({
        num: 2,
        name: "employeeA cannot read company B's rules, facts, submissions, versions, findings, comments or audit log (zero rows)",
        passed: false,
        error: err?.message,
      });
    }

    // ─── Test 3: employeeA cannot read company A's audit log (employer only) ─
    try {
      const { data: auditA, error } = await clientEmpA
        .from('audit_log')
        .select('*')
        .eq('company_id', compA.id);

      const passed = !error && (auditA?.length ?? 0) === 0;
      results.push({
        num: 3,
        name: "employeeA cannot read company A's audit log (employer only)",
        passed,
      });
    } catch (err: any) {
      results.push({
        num: 3,
        name: "employeeA cannot read company A's audit log (employer only)",
        passed: false,
        error: err?.message,
      });
    }

    // ─── Test 4: employeeA sees only their own submissions in company A ─────
    try {
      const { data: subsA, error } = await clientEmpA
        .from('submissions')
        .select('*')
        .eq('company_id', compA.id);

      const seesOwn = (subsA || []).some((s: any) => s.id === subEmpA.id);
      const seesOwner = (subsA || []).some((s: any) => s.id === subOwnerA.id);
      const passed = !error && seesOwn && !seesOwner;
      results.push({
        num: 4,
        name: "employeeA sees only their own submissions in company A, not ownerA's",
        passed,
      });
    } catch (err: any) {
      results.push({
        num: 4,
        name: "employeeA sees only their own submissions in company A, not ownerA's",
        passed: false,
        error: err?.message,
      });
    }

    // ─── Test 5: ownerA can read all submissions in company A ───────────────
    try {
      const { data: ownerSubsA, error } = await clientOwnerA
        .from('submissions')
        .select('*')
        .eq('company_id', compA.id);

      const seesOwn = (ownerSubsA || []).some((s: any) => s.id === subOwnerA.id);
      const seesEmp = (ownerSubsA || []).some((s: any) => s.id === subEmpA.id);
      const passed = !error && seesOwn && seesEmp;
      results.push({
        num: 5,
        name: 'ownerA can read all submissions in company A',
        passed,
      });
    } catch (err: any) {
      results.push({
        num: 5,
        name: 'ownerA can read all submissions in company A',
        passed: false,
        error: err?.message,
      });
    }

    // ─── Test 6: employeeA cannot insert a rule into company A or B ─────────
    try {
      const { data: insA, error: errA } = await clientEmpA
        .from('rules')
        .insert({
          company_id: compA.id,
          code: `R-EMP-A-${runId}`,
          category: 'tone',
          title: 'Emp Rule A',
          body: 'Body',
        })
        .select();

      const { data: insB, error: errB } = await clientEmpA
        .from('rules')
        .insert({
          company_id: compB.id,
          code: `R-EMP-B-${runId}`,
          category: 'tone',
          title: 'Emp Rule B',
          body: 'Body',
        })
        .select();

      const blockedA = Boolean(errA) || (insA?.length ?? 0) === 0;
      const blockedB = Boolean(errB) || (insB?.length ?? 0) === 0;
      const passed = blockedA && blockedB;
      results.push({
        num: 6,
        name: 'employeeA cannot insert a rule into company A or into company B',
        passed,
      });
    } catch (err: any) {
      results.push({
        num: 6,
        name: 'employeeA cannot insert a rule into company A or into company B',
        passed: false,
        error: err?.message,
      });
    }

    // ─── Test 7: ownerA can insert/delete in company A but not insert in B ──
    try {
      const codeA = `R-OWN-A-${runId}`;
      const { data: insA, error: errA } = await clientOwnerA
        .from('rules')
        .insert({
          company_id: compA.id,
          code: codeA,
          category: 'tone',
          title: 'Owner Rule A',
          body: 'Body',
        })
        .select();

      const canInsertA = !errA && (insA?.length ?? 0) > 0;
      let canDeleteA = false;
      if (canInsertA && insA?.[0]?.id) {
        const { error: delErr } = await clientOwnerA
          .from('rules')
          .delete()
          .eq('id', insA[0].id);
        canDeleteA = !delErr;
      }

      const { data: insB, error: errB } = await clientOwnerA
        .from('rules')
        .insert({
          company_id: compB.id,
          code: `R-OWN-B-${runId}`,
          category: 'tone',
          title: 'Owner Rule B',
          body: 'Body',
        })
        .select();

      const blockedB = Boolean(errB) || (insB?.length ?? 0) === 0;
      const passed = canInsertA && canDeleteA && blockedB;
      results.push({
        num: 7,
        name: 'ownerA can insert and delete a rule in company A but cannot insert one in company B',
        passed,
      });
    } catch (err: any) {
      results.push({
        num: 7,
        name: 'ownerA can insert and delete a rule in company A but cannot insert one in company B',
        passed: false,
        error: err?.message,
      });
    }

    // ─── Test 8: employeeA cannot change own role to employer ────────────────
    try {
      const { data: updData, error: updErr } = await clientEmpA
        .from('memberships')
        .update({ role: 'employer' })
        .eq('user_id', userMap.employeeA)
        .eq('company_id', compA.id)
        .select();

      // Check current role in DB via admin
      const { data: currentMember } = await admin
        .from('memberships')
        .select('role')
        .eq('user_id', userMap.employeeA)
        .eq('company_id', compA.id)
        .single();

      const zeroRowsUpdated = (updData?.length ?? 0) === 0;
      const roleUnchanged = currentMember?.role === 'employee';
      const passed = (zeroRowsUpdated || Boolean(updErr)) && roleUnchanged;

      results.push({
        num: 8,
        name: 'employeeA cannot change their own role to employer (the update must change zero rows)',
        passed,
      });
    } catch (err: any) {
      results.push({
        num: 8,
        name: 'employeeA cannot change their own role to employer (the update must change zero rows)',
        passed: false,
        error: err?.message,
      });
    }

    // ─── Test 9: employeeA findings update permissions ──────────────────────
    try {
      // 1. Try to update ownerA's finding (should fail / 0 rows)
      const { data: updOwnerFinding, error: updOwnerErr } = await clientEmpA
        .from('findings')
        .update({ decision: 'accepted' })
        .eq('id', findingOwnerA.id)
        .select();

      const { data: currentOwnerFinding } = await admin
        .from('findings')
        .select('decision')
        .eq('id', findingOwnerA.id)
        .single();

      const blockedOnOther =
        ((updOwnerFinding?.length ?? 0) === 0 || Boolean(updOwnerErr)) &&
        currentOwnerFinding?.decision === 'pending';

      // 2. Try to update employeeA's finding (should succeed)
      const { data: updEmpFinding, error: updEmpErr } = await clientEmpA
        .from('findings')
        .update({ decision: 'accepted' })
        .eq('id', findingEmpA.id)
        .select();

      const allowedOnOwn = !updEmpErr && (updEmpFinding?.length ?? 0) > 0 && updEmpFinding?.[0]?.decision === 'accepted';
      const passed = blockedOnOther && allowedOnOwn;

      results.push({
        num: 9,
        name: "employeeA cannot update a finding on someone else's submission, but can update a finding on their own submission",
        passed,
      });
    } catch (err: any) {
      results.push({
        num: 9,
        name: "employeeA cannot update a finding on someone else's submission, but can update a finding on their own submission",
        passed: false,
        error: err?.message,
      });
    }

    // ─── Test 10: Client with no session reads zero rows from every table ────
    try {
      const allTables = [
        'companies',
        'memberships',
        'rules',
        'facts',
        'terms',
        'submissions',
        'versions',
        'findings',
        'comments',
        'approvals',
        'escalations',
        'audit_log',
      ];

      let allEmpty = true;
      for (const table of allTables) {
        const { data, error } = await clientAnon.from(table).select('*');
        if (!error && (data?.length ?? 0) > 0) {
          allEmpty = false;
          break;
        }
      }

      results.push({
        num: 10,
        name: 'A client with no session reads zero rows from every table',
        passed: allEmpty,
      });
    } catch (err: any) {
      results.push({
        num: 10,
        name: 'A client with no session reads zero rows from every table',
        passed: false,
        error: err?.message,
      });
    }

    // ─── Test 11: outsider reads zero rows from every table ──────────────────
    try {
      const allTables = [
        'companies',
        'memberships',
        'rules',
        'facts',
        'terms',
        'submissions',
        'versions',
        'findings',
        'comments',
        'approvals',
        'escalations',
        'audit_log',
      ];

      let allEmpty = true;
      for (const table of allTables) {
        const { data, error } = await clientOutsider.from(table).select('*');
        if (!error && (data?.length ?? 0) > 0) {
          allEmpty = false;
          break;
        }
      }

      results.push({
        num: 11,
        name: 'outsider (member of no company) reads zero rows from every table',
        passed: allEmpty,
      });
    } catch (err: any) {
      results.push({
        num: 11,
        name: 'outsider (member of no company) reads zero rows from every table',
        passed: false,
        error: err?.message,
      });
    }
  } finally {
    // ─── Cleanup ──────────────────────────────────────────────────────────
    console.log('\nCleaning up test data and users...');
    for (const cId of createdCompanyIds) {
      try {
        await admin.from('audit_log').delete().eq('company_id', cId);
        await admin.from('comments').delete().in(
          'submission_id',
          (await admin.from('submissions').select('id').eq('company_id', cId)).data?.map((s) => s.id) || [],
        );
        const subIds = (await admin.from('submissions').select('id').eq('company_id', cId)).data?.map((s) => s.id) || [];
        const verIds = (await admin.from('versions').select('id').in('submission_id', subIds)).data?.map((v) => v.id) || [];
        if (verIds.length > 0) {
          await admin.from('findings').delete().in('version_id', verIds);
        }
        if (subIds.length > 0) {
          await admin.from('versions').delete().in('submission_id', subIds);
          await admin.from('approvals').delete().in('submission_id', subIds);
          await admin.from('escalations').delete().in('submission_id', subIds);
          await admin.from('submissions').delete().in('id', subIds);
        }
        await admin.from('rules').delete().eq('company_id', cId);
        await admin.from('facts').delete().eq('company_id', cId);
        await admin.from('terms').delete().eq('company_id', cId);
        await admin.from('memberships').delete().eq('company_id', cId);
        await admin.from('companies').delete().eq('id', cId);
      } catch (err) {
        console.error(`Failed to cleanup company ${cId}:`, err);
      }
    }

    for (const uId of createdUserIds) {
      try {
        await admin.auth.admin.deleteUser(uId);
      } catch (err) {
        console.error(`Failed to delete test user ${uId}:`, err);
      }
    }
  }

  // ─── Print Results & Summary ──────────────────────────────────────────────
  console.log('\n--- RLS Policy Test Results ---');
  let passCount = 0;
  for (const r of results) {
    const status = r.passed ? 'PASS' : 'FAIL';
    console.log(`${r.num}. ${status} - ${r.name}${r.error ? ` (Error: ${r.error})` : ''}`);
    if (r.passed) passCount++;
  }

  console.log(`\n${passCount} of ${results.length} passed\n`);

  if (passCount !== results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error during RLS testing:', err);
  process.exit(1);
});
