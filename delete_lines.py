import requests
import json
import subprocess

def get_secret(var):
    result = subprocess.run(["/Users/126colby/bin/tokens", "show", var, "--value-only"], capture_output=True, text=True, check=True)
    return result.stdout.strip()

account = get_secret("CLOUDFLARE_ACCOUNT_ID")
token = get_secret("CLOUDFLARE_API_TOKEN")

url = f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/70b7b632-98af-4635-a9d0-271f02a63ef3/query"
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
data = {"sql": "DELETE FROM episode_transcript_lines WHERE episode_id = '0efd56dc-9c2b-424a-be8b-c50edb283914'"}
r = requests.post(url, headers=headers, json=data)
print(r.json())
