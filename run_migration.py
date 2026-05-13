import subprocess
import os

def get_secret(var):
    result = subprocess.run(["/Users/126colby/bin/tokens", "show", var, "--value-only"], capture_output=True, text=True, check=True)
    # the value might have ansi colors if --value-only isn't respected, so we strip
    import re
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    clean = ansi_escape.sub('', result.stdout).strip()
    return clean

token = get_secret("CLOUDFLARE_WRANGLER_API_TOKEN")
account = get_secret("CLOUDFLARE_ACCOUNT_ID")

env = os.environ.copy()
env["CLOUDFLARE_API_TOKEN"] = token
env["CLOUDFLARE_ACCOUNT_ID"] = account
env["PATH"] = env.get("PATH", "") + ":/Users/126colby/bin:/Volumes/Projects/node/bin"

print("Running update...")
subprocess.run(["/Volumes/Projects/node/bin/pnpm", "dlx", "wrangler", "d1", "execute", "DB", "--remote", "--command", "UPDATE episode_transcript_lines SET host_id = 'c53f3e1a-5b12-4c2b-b413-5a0a382e2c56' WHERE is_host = 1;"], env=env, check=True)
