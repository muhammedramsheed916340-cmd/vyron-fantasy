#!/usr/bin/env python3
"""Test TG API match-detail endpoint and other possible contest endpoints."""
import urllib.request
import urllib.error
import json

TG_API_BASE = "https://tgsoftware-api.online/api"
JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZDEyOWZjYzUzMjBjNDEwNWMxZmYyNyIsImlhdCI6MTc4NjQ0NDUyMywiZXhwIjoxNzg3NjU0MTIzfQ.xtTwCAFlEfcxqMsGUa7xMi05MfeXKPdsjTYmL1Idboo"

# Test match detail endpoint (might include contest info)
print("=" * 60)
print("Test match-detail endpoint with various IDs and auth")
print("=" * 60)

# Test with matchId 113672 (MO vs SUL)
match_id = 113672

endpoints = [
    # Match detail
    ("GET", f"{TG_API_BASE}/fantasy/match-detail/{match_id}", None),
    ("POST", f"{TG_API_BASE}/fantasy/match-detail", {"matchId": match_id}),
    ("POST", f"{TG_API_BASE}/fantasy/match-detail", {"matchId": match_id, "token": JWT}),
    # Try with JWT auth header
    ("GET", f"{TG_API_BASE}/fantasy/match-detail/{match_id}", None),  # with JWT header
    # Contest-specific with JWT
    ("POST", f"{TG_API_BASE}/fantasy/list-contests", {"matchId": match_id, "token": JWT, "fantasyApp": "dream11"}),
    ("POST", f"{TG_API_BASE}/fantasy/contests", {"matchId": match_id, "token": JWT, "fantasyApp": "dream11"}),
    # Try sending JWT as different param names
    ("POST", f"{TG_API_BASE}/fantasy/list-contests", {"matchId": match_id, "jwt": JWT, "fantasyApp": "dream11"}),
    ("POST", f"{TG_API_BASE}/fantasy/list-contests", {"matchId": match_id, "authorization": JWT, "fantasyApp": "dream11"}),
    # Maybe the contest endpoint uses a different path structure
    ("GET", f"{TG_API_BASE}/fantasy/contest/{match_id}", None),
    ("GET", f"{TG_API_BASE}/fantasy/contests/dream11/{match_id}", None),
    ("POST", f"{TG_API_BASE}/fantasy/contest/list", {"matchId": match_id, "fantasyApp": "dream11", "token": JWT}),
    # With sportIndex
    ("POST", f"{TG_API_BASE}/fantasy/list-contests", {"matchId": match_id, "fantasyApp": "dream11", "token": JWT, "sportIndex": 0}),
]

for method, url, body in endpoints:
    use_jwt_header = "JWT header" in str(method)  # just use it for the match-detail with JWT
    try:
        if body:
            body_bytes = json.dumps(body).encode('utf-8')
            req = urllib.request.Request(url, data=body_bytes, method=method)
            req.add_header('Content-Type', 'application/json')
        else:
            req = urllib.request.Request(url, method=method)
            req.add_header('Accept', 'application/json')
        
        # Add JWT as Authorization header for some requests
        if JWT and ("token" in str(body) or "jwt" in str(body) or "authorization" in str(body) or match_id in [113672]):
            req.add_header('Authorization', f'Bearer {JWT}')
        
        path_short = url.replace(TG_API_BASE, '[TG]')
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = resp.read().decode()
            try:
                parsed = json.loads(data)
                preview = json.dumps(parsed, indent=2)[:300]
            except:
                preview = data[:300]
            print(f"  ✅ {method} {path_short} → HTTP {resp.status}")
            print(f"     {preview}")
    except urllib.error.HTTPError as e:
        body_text = ''
        try: body_text = e.read().decode()[:200]
        except: pass
        path_short = url.replace(TG_API_BASE, '[TG]')
        is_html_404 = '<!DOCTYPE' in body_text
        if not is_html_404 or e.code != 404:
            print(f"  ❌ {method} {path_short} → HTTP {e.code}")
            print(f"     {body_text}")
        else:
            print(f"  ❌ {method} {path_short} → HTTP 404 (route not found)")
    except Exception as e:
        path_short = url.replace(TG_API_BASE, '[TG]')
        print(f"  ⚠️ {method} {path_short} → Error: {str(e)[:100]}")

# Test our own match-detail API route
print("\n" + "=" * 60)
print("Test our own Next.js match-detail route")
print("=" * 60)

try:
    url = f"http://localhost:3000/api/match-detail?matchId=113672&sportIndex=0"
    req = urllib.request.Request(url, method='GET')
    with urllib.request.urlopen(req, timeout=5) as resp:
        data = json.loads(resp.read().decode())
        print(f"  HTTP {resp.status}: {json.dumps(data, indent=2)[:300]}")
except Exception as e:
    print(f"  Error (expected if dev server not running): {e}")

print("\nDone!")
