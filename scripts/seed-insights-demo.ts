import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ─── Environment Setup ───────────────────────────────────────────────────────

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

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY');
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// ─── Main Seed Function ──────────────────────────────────────────────────────

async function main() {
  console.log('=== Seeding Insights Demo (Sample Data) ===\n');

  const admin = createAdminClient();

  const COMPANY_NAME = 'Insights Demo (sample data)';
  const JOIN_CODE = 'INSDMO';

  // 1. Cleanup any previous data for this sample company only
  console.log(`Checking for existing company "${COMPANY_NAME}"...`);
  const { data: existingCompany } = await admin
    .from('companies')
    .select('id')
    .eq('name', COMPANY_NAME)
    .maybeSingle();

  if (existingCompany) {
    const companyId = existingCompany.id;
    console.log(`Cleaning up existing sample company data for ${companyId}...`);

    const { data: existingSubs } = await admin
      .from('submissions')
      .select('id')
      .eq('company_id', companyId);
    const subIds = (existingSubs || []).map((s: any) => s.id);

    if (subIds.length > 0) {
      const { data: existingVers } = await admin
        .from('versions')
        .select('id')
        .in('submission_id', subIds);
      const verIds = (existingVers || []).map((v: any) => v.id);

      if (verIds.length > 0) {
        await admin.from('findings').delete().in('version_id', verIds);
      }
      try {
        await admin.from('comments').delete().in('submission_id', subIds);
      } catch {}
      await admin.from('versions').delete().in('submission_id', subIds);
      await admin.from('submissions').delete().eq('company_id', companyId);
    }

    await admin.from('rules').delete().eq('company_id', companyId);
    await admin.from('facts').delete().eq('company_id', companyId);
    await admin.from('terms').delete().eq('company_id', companyId);
    await admin.from('audit_logs').delete().eq('company_id', companyId);
    await admin.from('memberships').delete().eq('company_id', companyId);
    await admin.from('companies').delete().eq('id', companyId);
    console.log('Previous sample company data removed successfully.');
  }

  // 2. Create or verify confirmed demo users
  console.log('\nCreating/verifying confirmed demo users...');
  const userDefs = [
    { email: 'employer.demo@example.com', displayName: 'Elena Employer', role: 'employer' },
    { email: 'reviewer.demo@example.com', displayName: 'Rohan Reviewer', role: 'reviewer' },
    { email: 'aarav.demo@example.com', displayName: 'Aarav', role: 'employee' },
    { email: 'meera.demo@example.com', displayName: 'Meera', role: 'employee' },
    { email: 'kabir.demo@example.com', displayName: 'Kabir', role: 'employee' },
  ];

  const { data: userListData } = await admin.auth.admin.listUsers();
  const existingUsers = userListData?.users || [];

  const userIdMap = new Map<string, string>(); // email -> userId

  for (const def of userDefs) {
    const existing = existingUsers.find(
      (u: any) => u.email?.toLowerCase() === def.email.toLowerCase(),
    );

    if (existing) {
      await admin.auth.admin.updateUserById(existing.id, {
        password: 'demo1234',
        email_confirm: true,
        user_metadata: { display_name: def.displayName },
      });
      userIdMap.set(def.email, existing.id);
      console.log(`  ✓ Updated user: ${def.email} (${def.displayName})`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: def.email,
        password: 'demo1234',
        email_confirm: true,
        user_metadata: { display_name: def.displayName },
      });
      if (error || !data.user) {
        throw new Error(`Failed to create ${def.email}: ${error?.message}`);
      }
      userIdMap.set(def.email, data.user.id);
      console.log(`  ✓ Created user: ${def.email} (${def.displayName})`);
    }
  }

  // 3. Create the company
  console.log('\nCreating company record...');
  const employerId = userIdMap.get('employer.demo@example.com')!;
  const { data: company, error: compErr } = await admin
    .from('companies')
    .insert({
      name: COMPANY_NAME,
      join_code: JOIN_CODE,
      owner_id: employerId,
    })
    .select('id, name, join_code')
    .single();

  if (compErr || !company) {
    throw new Error(`Failed to create company: ${compErr?.message}`);
  }
  console.log(`  ✓ Company created: "${company.name}" (ID: ${company.id}, Code: ${company.join_code})`);

  // 4. Create memberships
  console.log('\nCreating memberships...');
  for (const def of userDefs) {
    const userId = userIdMap.get(def.email)!;
    const { error: mErr } = await admin.from('memberships').insert({
      company_id: company.id,
      user_id: userId,
      role: def.role,
      display_name: def.displayName,
    });
    if (mErr) {
      throw new Error(`Failed to create membership for ${def.email}: ${mErr.message}`);
    }
    console.log(`  ✓ Membership: ${def.displayName} as ${def.role}`);
  }

  // 5. Load rules, facts, terms from seed/sample-brand-kit.json + T-9
  console.log('\nLoading brand kit rules, facts, and terms...');
  const kitPath = path.resolve(process.cwd(), 'seed/sample-brand-kit.json');
  const kit = JSON.parse(fs.readFileSync(kitPath, 'utf8'));

  // Rules
  const rulesToInsert = [
    ...kit.rules.map((r: any) => ({
      company_id: company.id,
      code: r.code,
      category: r.category,
      title: r.title,
      body: r.body,
    })),
    // Deliberately vague rule requested:
    {
      company_id: company.id,
      code: 'T-9',
      category: 'tone',
      title: 'Keep it on brand',
      body: 'Make sure the post feels on brand.',
    },
  ];

  const { error: rErr } = await admin.from('rules').insert(rulesToInsert);
  if (rErr) throw new Error(`Failed to insert rules: ${rErr.message}`);
  console.log(`  ✓ Inserted ${rulesToInsert.length} rules (including T-9 "Keep it on brand")`);

  // Facts
  const factsToInsert = kit.facts.map((f: any) => ({
    company_id: company.id,
    code: f.code,
    statement: f.statement,
    source: f.source,
  }));
  const { error: fErr } = await admin.from('facts').insert(factsToInsert);
  if (fErr) throw new Error(`Failed to insert facts: ${fErr.message}`);
  console.log(`  ✓ Inserted ${factsToInsert.length} facts`);

  // Terms
  const termsToInsert = kit.terms.map((t: any) => ({
    company_id: company.id,
    preferred: t.preferred,
    avoid: t.avoid,
    note: t.note,
  }));
  const { error: tErr } = await admin.from('terms').insert(termsToInsert);
  if (tErr) throw new Error(`Failed to insert terms: ${tErr.message}`);
  console.log(`  ✓ Inserted ${termsToInsert.length} terminology pairs`);

  // 6. Generate 48 Submissions across the last 21 days
  console.log('\nGenerating 48 realistic submissions, versions, and findings...');

  const aaravId = userIdMap.get('aarav.demo@example.com')!;
  const meeraId = userIdMap.get('meera.demo@example.com')!;
  const kabirId = userIdMap.get('kabir.demo@example.com')!;

  const now = new Date();
  function daysAgo(days: number, hour: number = 10, minute: number = 0): string {
    const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    d.setUTCHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  interface FindingPlan {
    rule_code: string;
    category: string;
    severity: 'low' | 'medium' | 'high';
    quoted_text: string;
    explanation: string;
    suggestion: string;
    decision: 'accepted' | 'edited' | 'rejected' | 'pending';
    decision_note?: string;
    edited_text?: string;
  }

  interface SubmissionPlan {
    authorId: string;
    authorName: string;
    title: string;
    daysAgo: number;
    hour: number;
    status: 'draft' | 'in_review' | 'approved' | 'changes_requested';
    v1Content: string;
    v1Findings: FindingPlan[];
    v2Content?: string;
  }

  const submissionPlans: SubmissionPlan[] = [];

  // ─── AARAV (18 submissions) ────────────────────────────────────────────────
  // Story: Aarav breaks C-1 ("No absolute claims: best, world's best, number one, guaranteed")
  // in 14 of his 18 posts! Decisions mostly accepted/edited, rejection < 15%.
  const aaravTitles = [
    { title: 'Morning Kickoff with FreshBrew Gold', claim: "the best coffee in Mumbai" },
    { title: 'Beat the Monday Blues with FreshBrew', claim: "guaranteed to give you instant energy" },
    { title: 'Our Secret to the Perfect Espresso', claim: "the world's best espresso beans" },
    { title: 'Fresh Brews for Bangalore Techies', claim: "the number one dark roast in Bangalore" },
    { title: 'Weekend Chill: Cold Brew Specials', claim: "voted the best cold brew in the country" },
    { title: 'Single Origin Spotlight: Colombia', claim: "guaranteed freshness straight from Bogota" },
    { title: 'Why Our Baristas Love Arabica', claim: "the absolute best caramel macchiato in town" },
    { title: 'Late Night Study Fuel for Students', claim: "the number one chosen late night fuel" },
    { title: 'FreshBrew Gold Aroma Revealed', claim: "guaranteed satisfaction in every single sip" },
    { title: 'Artisan Pour Over Techniques', claim: "hands down the best pour over experience" },
    { title: 'Celebrate International Coffee Day', claim: "the world's best festive coffee hampers" },
    { title: 'Roaster Notes: Hazelnut Supreme', claim: "voted best flavoured coffee two years running" },
    { title: 'Cold Brew vs Iced Latte Debate', claim: "the number one iced beverage this summer" },
    { title: 'Brewing Coffee on the Go', claim: "guaranteed easiest travel mug brew ever made" },
    // 4 posts without C-1
    { title: 'A Quick Guide to Medium Roasts', claim: null },
    { title: 'Meet our Head Roaster Prakash', claim: null },
    { title: 'Eco-friendly Cups at FreshBrew', claim: null },
    { title: 'Customer Spotlight of the Week', claim: null },
  ];

  const aaravDays = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 4, 3, 1];

  for (let i = 0; i < 18; i++) {
    const item = aaravTitles[i];
    const subDays = aaravDays[i];
    const isRecent = subDays <= 2;
    const hasV2 = i === 1 || i === 4; // Submissions 2 and 5 have version 2

    const v1Findings: FindingPlan[] = [];

    if (item.claim) {
      // 1 rejection out of 14, 11 accepted, 2 edited
      let decision: 'accepted' | 'edited' | 'rejected' = 'accepted';
      let decision_note: string | undefined = undefined;
      let edited_text: string | undefined = undefined;

      if (i === 13) {
        decision = 'rejected';
        decision_note = 'This is creative hyperbole for an informal social post.';
      } else if (i === 3 || i === 7) {
        decision = 'edited';
        edited_text = 'a beloved dark roast crafted for coffee lovers';
      }

      v1Findings.push({
        rule_code: 'C-1',
        category: 'claims',
        severity: 'high',
        quoted_text: item.claim,
        explanation: 'Avoid absolute claims like "best", "world\'s best", or "guaranteed".',
        suggestion: 'Rephrase using descriptive terms like "handcrafted", "signature", or "popular".',
        decision: isRecent && i === 17 ? 'pending' : decision,
        decision_note,
        edited_text,
      });
    }

    // Occasional T-9 or T-1 finding on Aarav's posts
    if (i === 2) {
      v1Findings.push({
        rule_code: 'T-9',
        category: 'tone',
        severity: 'low',
        quoted_text: 'Our Secret to the Perfect Espresso',
        explanation: 'Make sure the post feels on brand.',
        suggestion: 'Ensure the voice embodies our brand.',
        decision: 'rejected',
        decision_note: 'Unclear what on brand means here, please provide specific guidance.',
      });
    } else if (i === 5) {
      v1Findings.push({
        rule_code: 'T-1',
        category: 'tone',
        severity: 'medium',
        quoted_text: 'Bogota sourcing logistics parameter overview',
        explanation: 'Write like a friendly neighbour: avoid corporate jargon.',
        suggestion: 'Say "How we bring beans home from Bogota".',
        decision: 'accepted',
      });
    }

    submissionPlans.push({
      authorId: aaravId,
      authorName: 'Aarav',
      title: item.title,
      daysAgo: subDays,
      hour: 10 + (i % 6),
      status: isRecent ? 'in_review' : hasV2 ? 'approved' : 'approved',
      v1Content: `Hey coffee lovers! ${item.title}. In today's post: ${item.claim || 'we share our passion for fresh medium roast coffee'}. Stop by our stores today!`,
      v1Findings,
      v2Content: hasV2
        ? `Hey coffee lovers! ${item.title}. In today's post, we share our signature coffee crafted fresh in our stores every morning. Visit us today!`
        : undefined,
    });
  }

  // ─── MEERA (20 submissions) ────────────────────────────────────────────────
  // Story: Meera starts with many findings and clearly improves over 3 weeks.
  // Week 1 (days 21-15): 7 posts with 3-4 findings each!
  // Week 2 (days 14-8): 7 posts with 1-2 findings each.
  // Week 3 (days 7-1): 6 posts with 0-1 finding each (mostly 0).
  const meeraTitles = [
    // Week 1 (Many findings)
    { title: 'CHEAP COFFEE IS HERE EVERYONE!!!', week: 1, day: 21 },
    { title: 'Guaranteed health cure with our green roast', week: 1, day: 20 },
    { title: 'Click here for the biggest outlet sale', week: 1, day: 19 },
    { title: 'Why cheap beans ruin your daily grind', week: 1, day: 18 },
    { title: 'The absolute best discount guaranteed today', week: 1, day: 17 },
    { title: 'Check out our 100 outlets in India now', week: 1, day: 16 },
    { title: 'Free delivery on all Rs 100 orders click here', week: 1, day: 15 },
    // Week 2 (Fewer findings)
    { title: 'Affordable Morning Brews for Early Birds', week: 2, day: 14 },
    { title: 'FreshBrew Gold: Our Medium Roast Story', week: 2, day: 13 },
    { title: 'Brewing Tips from FreshBrew Baristas', week: 2, day: 12 },
    { title: 'Colombian Beans: What Makes Them Special', week: 2, day: 11 },
    { title: 'How to Store Your Whole Coffee Beans', week: 2, day: 10 },
    { title: 'Our 42 Stores are Ready for the Weekend', week: 2, day: 9 },
    { title: 'Cozy Rain and Fresh Brewed Warmth', week: 2, day: 8 },
    // Week 3 (Clean / 0-1 findings - clearly improved!)
    { title: 'Morning Sunshine and FreshBrew Gold', week: 3, day: 7 },
    { title: 'Ethical Sourcing from Colombian Highlands', week: 3, day: 6 },
    { title: 'A Warm Welcome at Our 42 Stores', week: 3, day: 5 },
    { title: 'Free Delivery on Orders Above Rs 499', week: 3, day: 4 },
    { title: 'Handcrafted Espresso Drinks for You', week: 3, day: 2 },
    { title: 'Celebrate the Weekend with Coffee Lovers', week: 3, day: 1 },
  ];

  for (let i = 0; i < 20; i++) {
    const item = meeraTitles[i];
    const isRecent = item.day <= 2;
    const hasV2 = i === 0 || i === 2 || i === 4;

    const v1Findings: FindingPlan[] = [];

    if (item.week === 1) {
      // 3 to 4 findings per post
      if (i === 0) {
        v1Findings.push(
          { rule_code: 'T-2', category: 'tone', severity: 'medium', quoted_text: 'CHEAP COFFEE IS HERE EVERYONE!!!', explanation: 'No all-caps words and no more than one exclamation mark.', suggestion: 'Use sentence case and at most one exclamation mark.', decision: 'accepted' },
          { rule_code: 'W-2', category: 'terminology', severity: 'high', quoted_text: 'cheap', explanation: 'Use the word affordable. Never use cheap.', suggestion: 'Replace "cheap" with "affordable".', decision: 'accepted' },
          { rule_code: 'T-9', category: 'tone', severity: 'low', quoted_text: 'CHEAP COFFEE IS HERE', explanation: 'Make sure the post feels on brand.', suggestion: 'Adjust post to feel on brand.', decision: 'rejected', decision_note: 'Unclear what on brand means for this promotion.' },
        );
      } else if (i === 1) {
        v1Findings.push(
          { rule_code: 'C-2', category: 'claims', severity: 'high', quoted_text: 'Guaranteed health cure', explanation: 'Do not claim coffee cures or treats conditions.', suggestion: 'Describe as refreshing and invigorating.', decision: 'accepted' },
          { rule_code: 'C-1', category: 'claims', severity: 'medium', quoted_text: 'Guaranteed', explanation: 'Avoid absolute claims like guaranteed.', suggestion: 'Remove guaranteed.', decision: 'accepted' },
          { rule_code: 'T-9', category: 'tone', severity: 'low', quoted_text: 'green roast', explanation: 'Make sure the post feels on brand.', suggestion: 'Align tone with brand voice.', decision: 'rejected', decision_note: 'Feedback too subjective and vague.' },
        );
      } else if (i === 2) {
        v1Findings.push(
          { rule_code: 'A-2', category: 'accessibility', severity: 'medium', quoted_text: 'Click here', explanation: 'Never use click here as link text.', suggestion: 'Use descriptive text like "Explore our sale".', decision: 'accepted' },
          { rule_code: 'T-1', category: 'tone', severity: 'low', quoted_text: 'biggest outlet sale', explanation: 'Use "stores" rather than "outlets".', suggestion: 'Say stores.', decision: 'edited', edited_text: 'storewide celebration' },
          { rule_code: 'T-9', category: 'tone', severity: 'low', quoted_text: 'biggest outlet sale', explanation: 'Make sure the post feels on brand.', suggestion: 'Keep it on brand.', decision: 'rejected', decision_note: 'Too vague, what specific wording is off brand?' },
        );
      } else if (i === 3) {
        v1Findings.push(
          { rule_code: 'W-2', category: 'terminology', severity: 'high', quoted_text: 'cheap beans', explanation: 'Never use cheap.', suggestion: 'Use affordable.', decision: 'accepted' },
          { rule_code: 'T-1', category: 'tone', severity: 'medium', quoted_text: 'ruin your daily grind', explanation: 'Maintain friendly and warm tone.', suggestion: 'Focus on positive advice.', decision: 'accepted' },
          { rule_code: 'W-1', category: 'terminology', severity: 'medium', quoted_text: 'freshbrew gold', explanation: 'Product name must be exactly FreshBrew Gold.', suggestion: 'Capitalize as FreshBrew Gold.', decision: 'accepted' },
        );
      } else if (i === 4) {
        v1Findings.push(
          { rule_code: 'C-1', category: 'claims', severity: 'high', quoted_text: 'absolute best discount guaranteed', explanation: 'Do not use best or guaranteed.', suggestion: 'Highlight the discount percentage.', decision: 'accepted' },
          { rule_code: 'C-3', category: 'claims', severity: 'medium', quoted_text: 'today', explanation: 'Any offer must state its end date.', suggestion: 'Add "Offer ends Sunday at midnight".', decision: 'accepted' },
          { rule_code: 'T-9', category: 'tone', severity: 'low', quoted_text: 'absolute best discount', explanation: 'Make sure the post feels on brand.', suggestion: 'Make sure post feels on brand.', decision: 'rejected', decision_note: 'Not actionable advice without concrete guidelines.' },
        );
      } else if (i === 5) {
        v1Findings.push(
          { rule_code: 'FA-1', category: 'facts', severity: 'high', quoted_text: '100 outlets in India', explanation: 'FreshBrew has 42 stores across India according to approved facts.', suggestion: 'Update number to 42 stores.', decision: 'accepted' },
          { rule_code: 'T-1', category: 'tone', severity: 'low', quoted_text: 'outlets', explanation: 'Our word for shops is stores.', suggestion: 'Use "stores".', decision: 'accepted' },
        );
      } else {
        v1Findings.push(
          { rule_code: 'FA-1', category: 'facts', severity: 'high', quoted_text: 'free delivery on all Rs 100 orders', explanation: 'Delivery is free on orders above Rs 499.', suggestion: 'Correct minimum amount to Rs 499.', decision: 'accepted' },
          { rule_code: 'A-2', category: 'accessibility', severity: 'medium', quoted_text: 'click here', explanation: 'Never use click here.', suggestion: 'Use "Order online today".', decision: 'accepted' },
        );
      }
    } else if (item.week === 2) {
      // 1 to 2 findings per post
      if (i === 7) {
        v1Findings.push({ rule_code: 'W-1', category: 'terminology', severity: 'medium', quoted_text: 'Fresh Brew Gold', explanation: 'Always write FreshBrew Gold without spaces.', suggestion: 'Write FreshBrew Gold.', decision: 'accepted' });
      } else if (i === 8) {
        v1Findings.push({ rule_code: 'T-9', category: 'tone', severity: 'low', quoted_text: 'Medium Roast Story', explanation: 'Make sure the post feels on brand.', suggestion: 'Ensure it feels on brand.', decision: 'rejected', decision_note: 'Unclear what feels on brand refers to here.' });
      } else if (i === 9) {
        v1Findings.push({ rule_code: 'T-1', category: 'tone', severity: 'low', quoted_text: 'Baristas must execute standard extraction', explanation: 'Speak in warm friendly tone.', suggestion: 'Our baristas love sharing their favourite brew tips.', decision: 'edited', edited_text: 'Our baristas love sharing simple brew secrets with you.' });
      } else if (i === 10) {
        v1Findings.push({ rule_code: 'T-9', category: 'tone', severity: 'low', quoted_text: 'Colombian Beans', explanation: 'Make sure the post feels on brand.', suggestion: 'Make it on brand.', decision: 'accepted' });
      } else if (i === 11) {
        v1Findings.push({ rule_code: 'W-1', category: 'terminology', severity: 'low', quoted_text: 'Freshbrew beans', explanation: 'Always write FreshBrew with capital B.', suggestion: 'Write FreshBrew.', decision: 'accepted' });
      } else {
        v1Findings.push({ rule_code: 'T-1', category: 'tone', severity: 'low', quoted_text: 'rainy season beverage catalogue', explanation: 'Friendly neighbour tone.', suggestion: 'Cosy up with a warm cup.', decision: 'accepted' });
        v1Findings.push({ rule_code: 'T-9', category: 'tone', severity: 'low', quoted_text: 'Cozy Rain and Fresh Brewed Warmth', explanation: 'Make sure the post feels on brand.', suggestion: 'Keep it on brand.', decision: 'edited', edited_text: 'Gentle morning rain with freshly poured coffee' });
      }
    } else {
      // Week 3: Clean! Only 2 findings across 6 posts
      if (i === 15) {
        v1Findings.push({ rule_code: 'W-1', category: 'terminology', severity: 'low', quoted_text: 'freshbrew gold', explanation: 'Capitalize as FreshBrew Gold.', suggestion: 'FreshBrew Gold.', decision: 'accepted' });
      } else if (i === 19) {
        v1Findings.push({ rule_code: 'T-9', category: 'tone', severity: 'low', quoted_text: 'Weekend vibe', explanation: 'Make sure the post feels on brand.', suggestion: 'Keep it on brand.', decision: isRecent ? 'pending' : 'rejected', decision_note: isRecent ? undefined : 'The post already adheres to our brand voice.' });
      }
    }

    submissionPlans.push({
      authorId: meeraId,
      authorName: 'Meera',
      title: item.title,
      daysAgo: item.day,
      hour: 9 + (i % 8),
      status: isRecent ? 'in_review' : hasV2 ? 'approved' : 'approved',
      v1Content: `Hello coffee community! ${item.title}. We are excited to welcome you into our stores this season with freshly roasted coffee.`,
      v1Findings,
      v2Content: hasV2
        ? `Hello coffee community! ${item.title.replace('CHEAP', 'Affordable').replace('click here', 'visit our stores')}. We are excited to welcome you into our stores this season with freshly roasted coffee.`
        : undefined,
    });
  }

  // ─── KABIR (10 submissions) ────────────────────────────────────────────────
  // Story: Kabir has few findings (6 posts with 0 findings, 4 posts with 1 finding).
  const kabirTitles = [
    { title: 'Sustainable Farming Partnerships in Ethiopia', day: 20, findingsCount: 0 },
    { title: 'The Art of Milk Frothing at Home', day: 18, findingsCount: 1, rule: 'A-1' },
    { title: 'Cold Brew vs Iced Drip: Key Differences', day: 16, findingsCount: 0 },
    { title: 'Why Water Quality Matters for Pour Over', day: 14, findingsCount: 0 },
    { title: 'Seasonal Roasts: Autumn Blend Preview', day: 12, findingsCount: 1, rule: 'C-3' },
    { title: 'Meet Anita: Our Store Manager in Pune', day: 10, findingsCount: 0 },
    { title: 'Behind the Scenes: Bean Roasting Day', day: 7, findingsCount: 0 },
    { title: 'Guide to Coffee Grind Sizes', day: 5, findingsCount: 1, rule: 'T-9' },
    { title: 'Single Origin Tasting Flights this Weekend', day: 3, findingsCount: 0 },
    { title: 'Morning Reflections with a Fresh Mug', day: 1, findingsCount: 1, rule: 'A-2' },
  ];

  for (let i = 0; i < 10; i++) {
    const item = kabirTitles[i];
    const isRecent = item.day <= 2;
    const hasV2 = i === 1;

    const v1Findings: FindingPlan[] = [];

    if (item.findingsCount === 1) {
      if (item.rule === 'A-1') {
        v1Findings.push({
          rule_code: 'A-1',
          category: 'accessibility',
          severity: 'medium',
          quoted_text: '[Image attached without alt text]',
          explanation: 'Every image needs descriptive alt text.',
          suggestion: 'Add alt text: "Barista pouring steamed milk into espresso with tulip latte art".',
          decision: 'accepted',
        });
      } else if (item.rule === 'C-3') {
        v1Findings.push({
          rule_code: 'C-3',
          category: 'claims',
          severity: 'medium',
          quoted_text: 'limited autumn blend discount',
          explanation: 'Discount must state its end date.',
          suggestion: 'Add "Offer ends November 30".',
          decision: 'edited',
          edited_text: 'autumn blend special through November 30',
        });
      } else if (item.rule === 'T-9') {
        v1Findings.push({
          rule_code: 'T-9',
          category: 'tone',
          severity: 'low',
          quoted_text: 'Guide to Coffee Grind Sizes',
          explanation: 'Make sure the post feels on brand.',
          suggestion: 'Keep it on brand.',
          decision: 'rejected',
          decision_note: 'Unclear what on brand means here, the technical guide is objective.',
        });
      } else if (item.rule === 'A-2') {
        v1Findings.push({
          rule_code: 'A-2',
          category: 'accessibility',
          severity: 'low',
          quoted_text: '#freshbrewmorning',
          explanation: 'Write hashtags in CamelCase.',
          suggestion: 'Write #FreshBrewMorning.',
          decision: isRecent ? 'pending' : 'accepted',
        });
      }
    }

    submissionPlans.push({
      authorId: kabirId,
      authorName: 'Kabir',
      title: item.title,
      daysAgo: item.day,
      hour: 11 + (i % 7),
      status: isRecent ? 'in_review' : 'approved',
      v1Content: `Good morning! ${item.title}. Handcrafted with care by our team at FreshBrew Gold. Enjoy your brew!`,
      v1Findings,
      v2Content: hasV2
        ? `Good morning! ${item.title}. Handcrafted with care by our team at FreshBrew Gold. [Alt: Barista pouring steamed milk with tulip latte art]. Enjoy your brew!`
        : undefined,
    });
  }

  // 7. Insert all 48 submissions, versions, and findings
  let totalSubmissionsInserted = 0;
  let totalVersionsInserted = 0;
  let totalFindingsInserted = 0;

  let acceptedCount = 0;
  let editedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;

  let t9DecidedCount = 0;
  let t9RejectedCount = 0;

  let otherDecidedCount = 0;
  let otherRejectedCount = 0;

  for (const plan of submissionPlans) {
    const createdAt = daysAgo(plan.daysAgo, plan.hour, 15);
    const updatedAt = daysAgo(plan.daysAgo, plan.hour + 2, 30);

    // Insert submission
    const { data: sub, error: sErr } = await admin
      .from('submissions')
      .insert({
        company_id: company.id,
        author_id: plan.authorId,
        title: plan.title,
        status: plan.status,
        created_at: createdAt,
        updated_at: updatedAt,
      })
      .select('id')
      .single();

    if (sErr || !sub) {
      throw new Error(`Failed to insert submission "${plan.title}": ${sErr?.message}`);
    }
    totalSubmissionsInserted++;

    // Insert Version 1
    const { data: v1, error: v1Err } = await admin
      .from('versions')
      .insert({
        submission_id: sub.id,
        version_no: 1,
        content: plan.v1Content,
        created_at: createdAt,
      })
      .select('id')
      .single();

    if (v1Err || !v1) {
      throw new Error(`Failed to insert v1 for "${plan.title}": ${v1Err?.message}`);
    }
    totalVersionsInserted++;

    // Insert findings for Version 1
    if (plan.v1Findings.length > 0) {
      const records = plan.v1Findings.map((f) => {
        totalFindingsInserted++;
        if (f.decision === 'accepted') acceptedCount++;
        else if (f.decision === 'edited') editedCount++;
        else if (f.decision === 'rejected') rejectedCount++;
        else if (f.decision === 'pending') pendingCount++;

        if (f.rule_code === 'T-9') {
          if (f.decision !== 'pending') {
            t9DecidedCount++;
            if (f.decision === 'rejected') t9RejectedCount++;
          }
        } else {
          if (f.decision !== 'pending') {
            otherDecidedCount++;
            if (f.decision === 'rejected') otherRejectedCount++;
          }
        }

        return {
          version_id: v1.id,
          source: 'rule_check',
          category: f.category,
          severity: f.severity,
          quoted_text: f.quoted_text,
          explanation: f.explanation,
          rule_code: f.rule_code,
          suggestion: f.suggestion,
          confidence: 0.95,
          decision: f.decision,
          decision_note: f.decision_note || null,
          edited_text: f.edited_text || null,
          created_at: createdAt,
        };
      });

      const { error: fErr } = await admin.from('findings').insert(records);
      if (fErr) {
        throw new Error(`Failed to insert findings for "${plan.title}": ${fErr.message}`);
      }
    }

    // Insert Version 2 if present
    if (plan.v2Content) {
      const v2CreatedAt = daysAgo(plan.daysAgo, plan.hour + 1, 45);
      const { data: v2, error: v2Err } = await admin
        .from('versions')
        .insert({
          submission_id: sub.id,
          version_no: 2,
          content: plan.v2Content,
          created_at: v2CreatedAt,
        })
        .select('id')
        .single();

      if (v2Err || !v2) {
        throw new Error(`Failed to insert v2 for "${plan.title}": ${v2Err?.message}`);
      }
      totalVersionsInserted++;
    }
  }

  // 8. Print Summary
  const t9Rate = t9DecidedCount > 0 ? ((t9RejectedCount / t9DecidedCount) * 100).toFixed(1) : '0';
  const otherRate = otherDecidedCount > 0 ? ((otherRejectedCount / otherDecidedCount) * 100).toFixed(1) : '0';

  console.log('\n===============================================================');
  console.log('✅ INSIGHTS DEMO SEED COMPLETED SUCCESSFULLY');
  console.log('===============================================================');
  console.log(`Company:       ${COMPANY_NAME}`);
  console.log(`Join Code:     ${JOIN_CODE}`);
  console.log(`Company ID:    ${company.id}`);
  console.log('---------------------------------------------------------------');
  console.log('Demo Users (Password: demo1234):');
  console.log('  Employer:    employer.demo@example.com  (Elena Employer)');
  console.log('  Reviewer:    reviewer.demo@example.com  (Rohan Reviewer)');
  console.log('  Employees:   aarav.demo@example.com     (Aarav)');
  console.log('               meera.demo@example.com     (Meera)');
  console.log('               kabir.demo@example.com     (Kabir)');
  console.log('---------------------------------------------------------------');
  console.log(`Submissions:   ${totalSubmissionsInserted} (over last 21 days)`);
  console.log('  - Aarav:     18 submissions (frequently breaks rule C-1 in 14 posts)');
  console.log('  - Meera:     20 submissions (starts with 3-4 findings/post, improves to ~0.3)');
  console.log('  - Kabir:     10 submissions (few findings: 6 posts clean, 4 minor)');
  console.log(`Versions:      ${totalVersionsInserted} (including 5 posts with v2 revisions)`);
  console.log(`Findings:      ${totalFindingsInserted} total`);
  console.log(`  - Accepted:  ${acceptedCount}`);
  console.log(`  - Edited:    ${editedCount}`);
  console.log(`  - Rejected:  ${rejectedCount}`);
  console.log(`  - Pending:   ${pendingCount}`);
  console.log('---------------------------------------------------------------');
  console.log(`Rule T-9 Rejection Rate:      ${t9Rate}% (${t9RejectedCount}/${t9DecidedCount} decided rejected)`);
  console.log(`Other Rules Rejection Rate:   ${otherRate}% (${otherRejectedCount}/${otherDecidedCount} decided rejected)`);
  console.log('===============================================================\n');
}

main().catch((err) => {
  console.error('Fatal error during seeding:', err);
  process.exit(1);
});
