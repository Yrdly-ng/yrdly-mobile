const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.COMMUNITY_PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
const migration = '20261018143334_complete_community_lifecycle.sql';
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db;
before(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('sub',auth.uid(),'role',auth.role()) $$;
    CREATE FUNCTION public.is_current_session_active() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid() IS NOT NULL $$;
    CREATE TABLE public.users(id uuid PRIMARY KEY, name text, avatar_url text, role text DEFAULT 'user', is_admin boolean DEFAULT false, phone_verified boolean DEFAULT true, blocked_users uuid[] DEFAULT '{}',home_state text,home_lga text,home_ward text);
    CREATE TABLE public.lga_wards(id uuid PRIMARY KEY, state text,lga text,ward text);
    CREATE TABLE public.moderation_queue(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), content_id uuid,table_name text,user_id uuid,status text,reason text,text_content text);
    CREATE TABLE public.followers(follower_id uuid,following_id uuid,PRIMARY KEY(follower_id,following_id));
    CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid,type text,title text,message text,sender_id uuid,related_id uuid,related_type text,data jsonb DEFAULT '{}',is_read boolean DEFAULT false,created_at timestamptz DEFAULT now());
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql AS $$ SELECT string_to_array($1,'/') $$;
    CREATE PUBLICATION supabase_realtime;`);
  const base = fs.readFileSync(
    path.join(root, 'supabase/migrations/20261003010000_create_communities.sql'),
    'utf8'
  );
  await db.exec(
    base
      .split('-- 10. SEED:')[0]
      .replace(
        /ALTER TABLE public.moderation_queue[\s\S]*?-- =============================================================================\n-- 1\./,
        '-- 1.'
      )
  );
  for (const file of [
    '20261003010001_community_like_rpc.sql',
    '20261003010003_fix_infinite_recursion_rls.sql',
    '20261006110130_community_approval_workflow.sql',
  ]) {
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'));
  }
  await db.exec(`CREATE TABLE public.community_invites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),community_id uuid REFERENCES communities(id),invited_user_id uuid REFERENCES users(id),invited_by uuid REFERENCES users(id),status text DEFAULT 'pending',created_at timestamptz DEFAULT now(),responded_at timestamptz,UNIQUE(community_id,invited_user_id));
    ALTER TABLE community_invites ENABLE ROW LEVEL SECURITY;
    CREATE POLICY memberships_insert_invite ON community_memberships FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM communities c WHERE c.id=community_memberships.community_id AND c.privacy='invite'));
    CREATE POLICY memberships_insert_mod ON community_memberships FOR INSERT WITH CHECK (public.is_community_mod_or_admin(community_id,auth.uid()) AND status='active');
    GRANT USAGE ON SCHEMA public,auth TO authenticated;
    GRANT SELECT ON public.users TO authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON community_memberships,community_join_requests,community_posts,community_comments,community_invites TO authenticated;`);
  await db.exec(
    fs.readFileSync(path.join(root, 'tests/fixtures/community-content-guards.sql'), 'utf8')
  );
  if (!process.env.COMMUNITY_TEST_BASELINE) {
    try {
      await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', migration), 'utf8'));
      await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations', '20261018172756_fix_community_legacy_insert_policy_recursion.sql'), 'utf8'));
    } catch (error) {
      throw new Error(`${error.message} (position ${error.position}; ${error.where || ''})`);
    }
  }
  await db.exec(`INSERT INTO users(id,name) SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'User '||n FROM generate_series(1,8) n;
    INSERT INTO communities(id,name,slug,type,privacy,created_by,approval_status) VALUES ('${id(100)}','Test group','test','interest','open','${id(1)}','approved');
    INSERT INTO community_memberships(community_id,user_id,role,status) VALUES ('${id(100)}','${id(1)}','admin','active'),('${id(100)}','${id(2)}','moderator','active'),('${id(100)}','${id(3)}','member','active');`);
  if (!process.env.COMMUNITY_TEST_BASELINE)
    await db.exec(`UPDATE communities SET owner_id='${id(1)}' WHERE id='${id(100)}'`);
});
beforeEach(async () => db.exec('BEGIN'));
afterEach(async () => db.exec('ROLLBACK'));
after(async () => db?.close());
async function actor(n) {
  await db.exec(
    `RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id(n)}',false),set_config('request.jwt.claim.role','authenticated',false); SET ROLE authenticated;`
  );
}
async function action(name, data = {}) {
  await db.exec('SAVEPOINT command');
  try {
    const result = (
      await db.query('SELECT public.community_action($1,$2,$3::jsonb) AS result', [
        id(100),
        name,
        JSON.stringify(data),
      ])
    ).rows[0].result;
    await db.exec('RELEASE SAVEPOINT command');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK TO SAVEPOINT command; RELEASE SAVEPOINT command');
    throw new Error(error.message);
  }
}
test('a moderator cannot create an admin membership through direct API writes', async () => {
  await actor(2);
  await assert.rejects(
    db.query(
      "INSERT INTO community_memberships(community_id,user_id,role,status) VALUES ($1,$2,'admin','active')",
      [id(100), id(4)]
    ),
    /permission|authorized|role/i
  );
});
test('joining, leaving and rejoining preserve contributions and never clear a ban', async () => {
  await actor(4);
  await action('join');
  await action('leave');
  await action('join');
  await actor(1);
  await action('ban', { userId: id(4) });
  await actor(4);
  await assert.rejects(action('leave'), /banned/i);
  await assert.rejects(action('join'), /banned/i);
});
test('join requests can be withdrawn, reviewed atomically and reapplied only after seven days', async () => {
  await db.exec("UPDATE communities SET privacy='request'");
  await actor(4);
  await action('request');
  await action('withdraw');
  await action('request');
  await actor(2);
  await action('review_request', { userId: id(4), decision: 'rejected' });
  await actor(4);
  await assert.rejects(action('request'), /seven days/);
  await db.exec(
    "RESET ROLE; UPDATE community_join_requests SET reviewed_at=now()-interval '8 days'"
  );
  await actor(4);
  await action('request');
  await actor(2);
  await action('review_request', { userId: id(4), decision: 'approved' });
  await actor(4);
  await action('leave');
  await action('request');
});
test('invitations require mutual friendship and recipient consent before private content access', async () => {
  await db.exec(
    `UPDATE communities SET privacy='invite'; INSERT INTO followers VALUES('${id(1)}','${id(4)}'),('${id(4)}','${id(1)}')`
  );
  await actor(1);
  await action('invite', { userId: id(4) });
  await actor(4);
  const metadata = await db.query('SELECT id FROM communities WHERE id=$1', [id(100)]);
  assert.equal(metadata.rows.length, 1);
  await action('accept_invite');
  await action('leave');
  await assert.rejects(action('accept_invite'), /pending invitation/);
  await actor(1);
  await assert.rejects(action('invite', { userId: id(5) }), /mutual/);
});
test('a submitted edit leaves the published version intact until trusted approval', async () => {
  await actor(3);
  const submitted = await action('submit_post', {
    content: 'Original neighbourhood update',
    imageUrls: [],
    videoUrls: [],
  });
  await db.exec(
    "RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false); SET ROLE service_role"
  );
  await db.query("SELECT community_review_content($1,'approved',NULL)", [submitted.reviewId]);
  await actor(3);
  const edited = await action('edit_post', {
    postId: submitted.id,
    content: 'Edited neighbourhood update',
    imageUrls: [],
    videoUrls: [],
  });
  const old = await db.query('SELECT content FROM community_posts WHERE id=$1', [submitted.id]);
  assert.equal(old.rows[0].content, 'Original neighbourhood update');
  await actor(1);
  await action('review_content', { reviewId: edited.reviewId, decision: 'approved' });
  const updated = await db.query('SELECT content FROM community_posts WHERE id=$1', [submitted.id]);
  assert.equal(updated.rows[0].content, 'Edited neighbourhood update');
});
test('ownership changes only after acceptance and only the owner can appoint admins', async () => {
  await actor(2);
  await assert.rejects(action('role', { userId: id(3), role: 'admin' }), /Moderators/);
  await actor(1);
  await action('offer_ownership', { userId: id(3) });
  await assert.rejects(action('leave'), /Transfer ownership/);
  await actor(3);
  await action('accept_ownership');
  await action('role', { userId: id(2), role: 'admin' });
  await actor(1);
  await action('leave');
  await actor(2);
  await assert.rejects(action('role', { userId: id(3), role: 'member' }), /owner membership/);
});
test('expired invitations cannot admit a user and invite identity cannot be changed directly', async () => {
  await db.exec(`INSERT INTO followers VALUES('${id(1)}','${id(4)}'),('${id(4)}','${id(1)}')`);
  await actor(1);
  await action('invite', { userId: id(4) });
  await db.exec("RESET ROLE; UPDATE community_invites SET expires_at=now()-interval '1 day'");
  await actor(4);
  await assert.rejects(action('accept_invite'), /valid pending invitation/);
  await assert.rejects(
    db.query('UPDATE community_invites SET community_id=$1 WHERE invited_user_id=$2', [
      id(100),
      id(4),
    ]),
    /permission denied/
  );
});
test('automatic location enrolment preserves departed and banned memberships', async () => {
  await db.exec(`INSERT INTO communities(id,name,slug,type,privacy,state,lga,is_official) VALUES('${id(101)}','Local group','local','lga','open','Lagos','Ikeja',true);
   UPDATE users SET home_state='Lagos',home_lga='Ikeja' WHERE id='${id(4)}';
   UPDATE community_memberships SET status='banned' WHERE community_id='${id(101)}' AND user_id='${id(4)}';
   UPDATE users SET home_lga='Other' WHERE id='${id(4)}'; UPDATE users SET home_lga='Ikeja' WHERE id='${id(4)}';`);
  await actor(4);
  assert.equal(
    (
      await db.query(
        'SELECT status FROM community_memberships WHERE community_id=$1 AND user_id=$2',
        [id(101), id(4)]
      )
    ).rows[0].status,
    'banned'
  );
});

test('legacy media stays attached when its author edits, but cannot be injected into another post', async () => {
  const legacy = 'https://example.com/previously-published-photo.jpg';
  await db.query(
    "INSERT INTO community_posts(id,community_id,author_id,author_name,content,image_urls,moderation_status) VALUES($1,$2,$3,'User 3','Legacy post',ARRAY[$4],'approved')",
    [id(200), id(100), id(3), legacy]
  );
  await actor(3);
  await action('edit_post', {
    postId: id(200),
    content: 'Updated legacy post',
    imageUrls: [legacy],
    videoUrls: [],
  });
  await assert.rejects(
    action('submit_post', { content: 'Injected attachment', imageUrls: [legacy], videoUrls: [] }),
    /uploaded/
  );
});
test('lifting a ban requires an actual ban', async () => {
  await actor(1);
  await assert.rejects(action('unban', { userId: id(3) }), /not banned/);
});

test('stored attachment MIME and size determine photo and video eligibility', async () => {
  const objectPath = `${id(100)}/${id(3)}/oversize.jpg`;
  await db.query(
    "INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('community-media',$1,$2::jsonb)",
    [objectPath, JSON.stringify({ size: 11 * 1024 * 1024, mimetype: 'image/jpeg' })]
  );
  await actor(3);
  await assert.rejects(
    action('submit_post', {
      content: 'Photo',
      imageUrls: [`storage://community-media/${objectPath}`],
      videoUrls: [],
    }),
    /media limits/
  );
  await db.exec('RESET ROLE');
  await db.query('UPDATE storage.objects SET metadata=$1::jsonb WHERE name=$2', [
    JSON.stringify({ size: 1024, mimetype: 'image/jpeg' }),
    objectPath,
  ]);
  await actor(3);
  await assert.rejects(
    action('submit_post', {
      content: 'Wrong category',
      imageUrls: [],
      videoUrls: [`storage://community-media/${objectPath}`],
    }),
    /media limits/
  );
  await action('submit_post', {
    content: 'Valid photo',
    imageUrls: [`storage://community-media/${objectPath}`],
    videoUrls: [],
  });
});

test('installed clients can join, mute, leave and post through guarded legacy table writes',async()=>{
 await actor(4);
 await db.query("INSERT INTO community_memberships(community_id,user_id,role,status,is_auto_joined) VALUES($1,$2,'member','active',false)",[id(100),id(4)]);
 await db.query('UPDATE community_memberships SET is_muted=true WHERE community_id=$1 AND user_id=$2',[id(100),id(4)]);
 const post=(await db.query("INSERT INTO community_posts(community_id,author_id,content,moderation_status) VALUES($1,$2,'Legacy client update','approved') RETURNING id,moderation_status",[id(100),id(4)])).rows[0];
 assert.equal(post.moderation_status,'pending');
 await db.query('DELETE FROM community_memberships WHERE community_id=$1 AND user_id=$2',[id(100),id(4)]);
 assert.equal((await db.query('SELECT status FROM community_memberships WHERE community_id=$1 AND user_id=$2',[id(100),id(4)])).rows[0].status,'left');
 await db.exec('RESET ROLE');
 assert.equal((await db.query('SELECT count(*)::int AS count FROM community_content_reviews WHERE target_id=$1',[post.id])).rows[0].count,1);
});

test('legacy request approval is atomic and old clients cannot remove their own ban',async()=>{
 await db.exec("UPDATE communities SET privacy='request'");
 await actor(4);
 await db.query("INSERT INTO community_join_requests(community_id,user_id,message) VALUES($1,$2,'Please join')",[id(100),id(4)]);
 await actor(1);
 await db.query("UPDATE community_join_requests SET status='approved' WHERE community_id=$1 AND user_id=$2",[id(100),id(4)]);
 await action('ban',{userId:id(4)});
 await actor(4);
 await assert.rejects(db.query('DELETE FROM community_memberships WHERE community_id=$1 AND user_id=$2',[id(100),id(4)]),/banned/);
});

test('new commands enqueue one review while legacy inserts keep their own trusted review',async()=>{
 await actor(3);
 const created=await action('submit_post',{content:'One review please',imageUrls:[],videoUrls:[]});
 await db.exec('RESET ROLE');
 assert.equal((await db.query('SELECT count(*)::int AS count FROM community_content_reviews WHERE target_id=$1',[created.id])).rows[0].count,1);
});
