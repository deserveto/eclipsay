import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser, isSupabaseServerConfigured } from '@/lib/supabase/server';

// Account deletion (PRD §58). Auth (auth.users row) cascade-deletes all
// application rows via FK on delete cascade.

export async function POST() {
  if (!isSupabaseServerConfigured()) {
    return Response.json({ error: 'unconfigured' }, { status: 500 });
  }
  const user = await getAuthUser();
  if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return Response.json({ error: 'delete_failed' }, { status: 500 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'delete_failed' }, { status: 500 });
  }
}
