#!/usr/bin/env python3
"""Test TG API with JWT token for admin/user endpoints."""
import urllib.request
import urllib.error
import json

TG_API_BASE = "https://tgsoftware-api.online/api"
JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZDEyOWZjYzUzMjBjNDEwNWMxZmYyNyIsImlhdCI6MTc4NjQ0NDUyMywiZXhwIjoxNzg3NjU0MTIzfQ.xtTwCAFlEfcxqMsGUa7xMi05MfeXKPdsjTYmL1Idboo"

match_id = 113672

print("=" * 60)
print("Test TG API with JWT as Authorization header")
print("=" * 60)

endpoints = [
    # User/profile endpoints
    ("GET", f"{TG_API_BASE}/user", None),
    ("GET", f"{TG_API_BASE}/auth/me", None),
    # Admin endpoints
    ("GET", f"{TG_API_BASE}/admin/matches", None),
    ("GET", f"{TG_API_BASE}/admin/contests", None),
    # Match-specific with JWT
    ("POST", f"{TG_API_BASE}/fantasy/list-contests", {"matchId": match_id, "fantasyApp": "dream11"}),
    ("POST", f"{TG_API_BASE}/fantasy/list-contests", {"matchId": match_id, "fantasyApp": "dream11", "sportIndex": 0}),
    # Try list-of-teams with JWT as authToken
    ("POST", f"{TG_API_BASE}/fantasy/list-of-teams", {"matchId": match_id, "fantasyApp": "dream11", "authToken": JWT}),
    # Try add-team just to test auth (won't actually add)
    # Maybe the JWT is for a different base URL
]

for method, url, body in endpoints:
    try:
        if body:
            body_bytes = json.dumps(body).encode('utf-8')
            req = urllib.request.Request(url, data=body_bytes, method=method)
            req.add_header('Content-Type', 'application/json')
        else:
            req = urllib.request.Request(url, method=method)
            req.add_header('Accept', 'application/json')
        
        req.add_header('Authorization', f'Bearer {JWT}')
        
        path_short = url.replace(TG_API_BASE, '[TG]')
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = resp.read().decode()
            try:
                parsed = json.loads(data)
                preview = json.dumps(parsed, indent=2)[:400]
            except:
                preview = data[:400]
            print(f"  ✅ {method} {path_short} → HTTP {resp.status}")
            print(f"     {preview}")
    except urllib.error.HTTPError as e:
        body_text = ''
        try: body_text = e.read().decode()[:200]
        except: pass
        path_short = url.replace(TG_API_BASE, '[TG]')
        is_html_404 = '<!DOCTYPE' in body_text
        if is_html_404:
            print(f"  ❌ {method} {path_short} → HTTP 404 (no route)")
        else:
            print(f"  ❌ {method} {path_short} → HTTP {e.code}")
            print(f"     {body_text}")
    except Exception as e:
        path_short = url.replace(TG_API_BASE, '[TG]')
        print(f"  ⚠️ {method} {path_short} → Error: {str(e)[:100]}")

# Try the list-of-teams with JWT as the authToken but no auth header
print("\n" + "=" * 60)
print("Test list-of-teams with JWT as authToken (no auth header)")
print("=" * 60)

try:
    url = f"{TG_API_BASE}/fantasy/list-of-teams"
    body = json.dumps({"matchId": match_id, "fantasyApp": "dream11", "authToken": JWT}).encode()
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, timeout=8) as resp:
        data = json.loads(resp.read().decode())
        print(f"  HTTP {resp.status}: {json.dumps(data, indent=2)[:300]}")
except urllib.error.HTTPError as e:
    body_text = ''
    try: body_text = e.read().decode()[:300]
    except: pass
    print(f"  HTTP {e.code}: {body_text}")
except Exception as e:
    print(f"  Error: {e}")

print("\nDone!")
