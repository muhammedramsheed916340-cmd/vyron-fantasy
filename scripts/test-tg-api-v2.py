#!/usr/bin/env python3
"""Test TG API with different auth and path variations."""
import urllib.request
import urllib.error
import json

TG_API_BASE = "https://tgsoftware-api.online/api"
JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5ZDEyOWZjYzUzMjBjNDEwNWMxZmYyNyIsImlhdCI6MTc4NjQ0NDUyMywiZXhwIjoxNzg3NjU0MTIzfQ.xtTwCAFlEfcxqMsGUa7xMi05MfeXKPdsjTYmL1Idboo"

print("=" * 60)
print("Test: list-of-teams with proper auth (no JWT header)")
print("=" * 60)

# The list-of-teams works in the app, let's test without JWT header
# but with a real authToken from verify-otp (which we don't have)
# Instead let's test what the TG API root returns

endpoints = [
    ("GET", f"{TG_API_BASE}", None),
    ("GET", "https://tgsoftware-api.online", None),
    ("GET", f"{TG_API_BASE}/fantasy", None),
    # Test with different paths that might work
    ("GET", f"{TG_API_BASE}/fantasy/matches/cricket", None),
    # The known working endpoint format
    ("POST", f"{TG_API_BASE}/fantasy/list-of-teams", {"fantasyApp": "dream11", "matchId": 1, "authToken": "fake"}),
    # Try with the JWT as the authToken
    ("POST", f"{TG_API_BASE}/fantasy/list-of-teams", {"fantasyApp": "dream11", "matchId": 1, "authToken": JWT}),
    # Try without /api prefix
    ("GET", "https://tgsoftware-api.online/fantasy/matches/cricket", None),
    ("POST", "https://tgsoftware-api.online/fantasy/list-of-teams", {"fantasyApp": "dream11", "matchId": 1, "authToken": JWT}),
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
        
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = resp.read().decode()
            status = resp.status
            try:
                parsed = json.loads(data)
                preview = json.dumps(parsed, indent=2)[:300]
            except:
                preview = data[:300]
            print(f"  ✅ {method} {url.replace(TG_API_BASE, '[TG]')} → HTTP {status}")
            print(f"     {preview}")
    except urllib.error.HTTPError as e:
        body_text = ''
        try:
            body_text = e.read().decode()[:200]
        except:
            pass
        print(f"  ❌ {method} {url.replace(TG_API_BASE, '[TG]')} → HTTP {e.code}")
        print(f"     {body_text}")
    except Exception as e:
        print(f"  ⚠️ {method} {url.replace(TG_API_BASE, '[TG]')} → Error: {str(e)[:100]}")

# Now let's try to decode a match to get a real matchId
print("\n" + "=" * 60)
print("Decode match data to get real matchId")
print("=" * 60)

try:
    url = f"{TG_API_BASE}/fantasy/matches/cricket"
    req = urllib.request.Request(url, method='GET')
    req.add_header('Accept', 'application/json')
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
        if data.get('status') == 'success' and data.get('data'):
            matches = data['data']
            print(f"  Got {len(matches)} encrypted matches")
            # Try to use PyCryptodome to decrypt
            try:
                from Crypto.Cipher import AES
                from Crypto.Util.Padding import unpad
                import base64
                print("  PyCryptodome available! Trying to decrypt...")
                
                KEY = b'coder_bobby_believer01_tg_software'[:32]  # AES-256 key
                
                for i, enc_match in enumerate(matches[:3]):
                    try:
                        # The encryption uses CryptoJS AES which is different from standard AES
                        # CryptoJS uses OpenSSL format: Salted__ + 8-byte salt + ciphertext
                        # Let's try a different approach
                        import hashlib
                        
                        raw = base64.b64decode(enc_match)
                        
                        # CryptoJS format: "Salted__" + salt(8) + ciphertext
                        if raw[:8] == b'Salted__':
                            salt = raw[8:16]
                            ciphertext = raw[16:]
                            
                            # Derive key and IV using MD5 (CryptoJS default)
                            def derive_key_iv(password, salt, key_len=32, iv_len=16):
                                dtot = b''
                                d = b''
                                while len(dtot) < key_len + iv_len:
                                    d = hashlib.md5(d + password + salt).digest()
                                    dtot += d
                                return dtot[:key_len], dtot[key_len:key_len+iv_len]
                            
                            key, iv = derive_key_iv(KEY, salt)
                            cipher = AES.new(key, AES.MODE_CBC, iv)
                            decrypted = unpad(cipher.decrypt(ciphertext), AES.block_size)
                            match_data = json.loads(decrypted.decode('utf-8'))
                            
                            match_id = match_data.get('id', 'N/A')
                            left_team = match_data.get('left_team_name', '?')
                            right_team = match_data.get('right_team_name', '?')
                            fantasy_list = match_data.get('fantasy_list', [])
                            sport_index = match_data.get('sport_index', 0)
                            
                            print(f"\n  Match {i+1}:")
                            print(f"    ID: {match_id} (type: {type(match_id).__name__})")
                            print(f"    Teams: {left_team} vs {right_team}")
                            print(f"    Sport Index: {sport_index}")
                            print(f"    Fantasy List: {fantasy_list}")
                            print(f"    All keys: {list(match_data.keys())}")
                    except Exception as e2:
                        print(f"  Match {i+1} decrypt error: {e2}")
                
            except ImportError:
                print("  PyCryptodome not available, trying pycryptodome...")
                try:
                    import subprocess
                    subprocess.run(["pip3", "install", "pycryptodome"], capture_output=True, timeout=30)
                    print("  Installed! Run again to decrypt.")
                except:
                    print("  Cannot install. Will use match IDs from app logs.")
except Exception as e:
    print(f"  Error: {e}")

print("\nDone!")
