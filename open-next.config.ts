import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Account, trial and teacher data always use Supabase, without a shared response cache.
export default defineCloudflareConfig();
