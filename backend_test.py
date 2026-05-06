"""
Backend test for the NEW /api/team/* endpoints (code+password wrapper flow).
Also runs regression checks on /api/ and /api/weather.
"""
import sys
import time
import requests

# Read EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env
def read_env_var(path: str, key: str) -> str:
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith(key + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""

BACKEND = read_env_var("/app/frontend/.env", "EXPO_PUBLIC_BACKEND_URL")
if not BACKEND:
    print("ERROR: EXPO_PUBLIC_BACKEND_URL not found in /app/frontend/.env")
    sys.exit(1)
API = BACKEND.rstrip("/") + "/api"
print(f"Using backend: {API}")

# Make device_id unique per run to avoid 409 from previous runs
TS = int(time.time())
DEVICE_ID = f"test_dev_{TS}"
ADMIN_PWD = "secret6"
COLLAB_A_PWD = "collabpwd"
COLLAB_B_PWD = "collab2pwd"

results = []

def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {detail}")
    results.append((name, ok, detail))

def call(method, path, **kwargs):
    url = API + path
    try:
        r = requests.request(method, url, timeout=30, **kwargs)
        try:
            body = r.json()
        except Exception:
            body = r.text
        return r.status_code, body
    except Exception as e:
        return -1, str(e)


# 1) admin_register first time
sc, body = call("POST", "/team/admin_register", json={
    "device_id": DEVICE_ID, "password": ADMIN_PWD,
    "nome_attivita": "Mario Srl", "nome_titolare": "Mario",
})
ok = (sc == 200 and isinstance(body, dict) and "access_token" in body
      and body.get("user", {}).get("role") == "owner")
record("1. admin_register first time → 200 + token + owner",
       ok, f"sc={sc} body_keys={list(body.keys()) if isinstance(body,dict) else type(body).__name__}")
admin_token = body.get("access_token") if ok else None
admin_id = body.get("user", {}).get("id") if ok else None

# 2) admin_register same device_id → 409
sc2, body2 = call("POST", "/team/admin_register", json={
    "device_id": DEVICE_ID, "password": ADMIN_PWD,
    "nome_attivita": "Mario Srl", "nome_titolare": "Mario",
})
record("2. admin_register duplicate device_id → 409",
       sc2 == 409, f"sc={sc2} body={body2}")

# 3) admin_login correct
sc3, body3 = call("POST", "/team/admin_login", json={
    "device_id": DEVICE_ID, "password": ADMIN_PWD,
})
ok3 = (sc3 == 200 and isinstance(body3, dict) and "access_token" in body3
       and body3.get("user", {}).get("role") == "owner")
record("3. admin_login correct → 200 + role owner",
       ok3, f"sc={sc3} role={(body3 or {}).get('user',{}).get('role')}")

# 4) admin_login wrong password → 401
sc4, body4 = call("POST", "/team/admin_login", json={
    "device_id": DEVICE_ID, "password": "WRONG",
})
record("4. admin_login wrong pwd → 401", sc4 == 401, f"sc={sc4}")

# 5) /api/auth/invites/create role=full
H_ADMIN = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}
sc5, body5 = call("POST", "/auth/invites/create", json={"role": "full"}, headers=H_ADMIN)
ok5 = (sc5 == 200 and isinstance(body5, dict)
       and body5.get("role") == "full" and isinstance(body5.get("code"), str)
       and len(body5.get("code", "")) == 8)
record("5. create invite role=full → 200 + 8-char code",
       ok5, f"sc={sc5} code={(body5 or {}).get('code')}")
invite_code_A = body5.get("code") if ok5 else None

# 6) /api/auth/invites/create role=operativo
sc6, body6 = call("POST", "/auth/invites/create", json={"role": "operativo"}, headers=H_ADMIN)
ok6 = (sc6 == 200 and isinstance(body6, dict)
       and body6.get("role") == "operativo" and isinstance(body6.get("code"), str))
record("6. create invite role=operativo → 200",
       ok6, f"sc={sc6} code={(body6 or {}).get('code')}")
invite_code_B = body6.get("code") if ok6 else None

# 7) join_by_code A
collab_A_token = None
collab_A_id = None
if invite_code_A:
    sc7, body7 = call("POST", "/team/join_by_code", json={
        "code": invite_code_A, "password": COLLAB_A_PWD,
    })
    ok7 = (sc7 == 200 and isinstance(body7, dict)
           and body7.get("user", {}).get("role") == "full"
           and body7.get("user", {}).get("account_owner_id") == admin_id)
    record("7. join_by_code A → 200, role=full, aoid matches admin",
           ok7, f"sc={sc7} role={(body7 or {}).get('user',{}).get('role')} aoid_match={(body7 or {}).get('user',{}).get('account_owner_id')==admin_id}")
    collab_A_token = body7.get("access_token") if ok7 else None
    collab_A_id = body7.get("user", {}).get("id") if ok7 else None

# 8) join_by_code SAME code A → 410
if invite_code_A:
    sc8, body8 = call("POST", "/team/join_by_code", json={
        "code": invite_code_A, "password": "another",
    })
    record("8. join_by_code A reuse → 410", sc8 == 410, f"sc={sc8} body={body8}")

# 9) login_by_code A correct
if invite_code_A:
    sc9, body9 = call("POST", "/team/login_by_code", json={
        "code": invite_code_A, "password": COLLAB_A_PWD,
    })
    ok9 = (sc9 == 200 and isinstance(body9, dict) and "access_token" in body9)
    record("9. login_by_code A correct → 200 + new token",
           ok9, f"sc={sc9} has_token={'access_token' in (body9 or {})}")

# 10) login_by_code A wrong password → 401
if invite_code_A:
    sc10, body10 = call("POST", "/team/login_by_code", json={
        "code": invite_code_A, "password": "WRONG",
    })
    record("10. login_by_code A wrong pwd → 401", sc10 == 401, f"sc={sc10}")

# 11) login_by_code non-existent → 403 or 401
sc11, body11 = call("POST", "/team/login_by_code", json={
    "code": "NOTEXIST", "password": "x",
})
record("11. login_by_code non-existent → 403 or 401",
       sc11 in (401, 403), f"sc={sc11}")

# 12) GET /api/team/status with collab_A_token
if collab_A_token:
    sc12, body12 = call("GET", "/team/status",
                        headers={"Authorization": f"Bearer {collab_A_token}"})
    ok12 = (sc12 == 200 and isinstance(body12, dict)
            and body12.get("ok") is True
            and body12.get("role") == "full"
            and body12.get("account_owner_id") == admin_id)
    record("12. team/status collab_A → ok, role=full, aoid match",
           ok12, f"sc={sc12} body={body12}")

# 13) /api/sync/push admin
push_payload = {"data": {
    "storicoGiornate": [{"d": "2025-06-01", "lordo": 500}],
    "nomeAttivita": "Mario Srl",
}}
sc13, body13 = call("POST", "/sync/push", json=push_payload, headers=H_ADMIN)
record("13. sync/push admin → 200", sc13 == 200, f"sc={sc13} body={body13}")

# 14) /api/sync/pull collab_A
if collab_A_token:
    sc14, body14 = call("GET", "/sync/pull",
                        headers={"Authorization": f"Bearer {collab_A_token}"})
    ok14 = (sc14 == 200 and isinstance(body14, dict)
            and isinstance(body14.get("data"), dict)
            and body14["data"].get("nomeAttivita") == "Mario Srl"
            and body14["data"].get("storicoGiornate") == [{"d": "2025-06-01", "lordo": 500}]
            and body14.get("role") == "full")
    record("14. sync/pull collab_A → 200, data matches, role=full",
           ok14, f"sc={sc14} role={(body14 or {}).get('role')}")

# 15) join_by_code B
collab_B_token = None
if invite_code_B:
    sc15, body15 = call("POST", "/team/join_by_code", json={
        "code": invite_code_B, "password": COLLAB_B_PWD,
    })
    ok15 = (sc15 == 200 and "access_token" in (body15 or {}))
    record("15. join_by_code B → 200",
           ok15, f"sc={sc15} role={(body15 or {}).get('user',{}).get('role')}")
    collab_B_token = (body15 or {}).get("access_token")

# 16) GET /api/team/collaborators_detailed
sc16, body16 = call("GET", "/team/collaborators_detailed", headers=H_ADMIN)
ok16 = (sc16 == 200 and isinstance(body16, list) and len(body16) == 2
        and all("code" in x for x in body16)
        and {invite_code_A, invite_code_B} == {x.get("code") for x in body16})
record("16. collaborators_detailed → 200, 2 items with codes",
       ok16, f"sc={sc16} count={len(body16) if isinstance(body16,list) else 'N/A'} codes={[x.get('code') for x in body16] if isinstance(body16,list) else 'N/A'}")

# 17) DELETE collaborator A
if collab_A_id:
    sc17, body17 = call("DELETE", f"/auth/collaborators/{collab_A_id}", headers=H_ADMIN)
    record("17. delete collaborator A → 200", sc17 == 200, f"sc={sc17} body={body17}")

# 18) login_by_code A after revocation → 403
if invite_code_A:
    sc18, body18 = call("POST", "/team/login_by_code", json={
        "code": invite_code_A, "password": COLLAB_A_PWD,
    })
    record("18. login_by_code A after revocation → 403", sc18 == 403, f"sc={sc18}")

# 19) /api/team/status with old collab_A_token → 403
if collab_A_token:
    sc19, body19 = call("GET", "/team/status",
                        headers={"Authorization": f"Bearer {collab_A_token}"})
    record("19. team/status with deleted user's old token → 403",
           sc19 == 403, f"sc={sc19} body={body19}")

# Regression
scR1, bodyR1 = call("GET", "/")
record("R1. GET /api/ → 200 Hello World",
       scR1 == 200 and isinstance(bodyR1, dict) and bodyR1.get("message") == "Hello World",
       f"sc={scR1} body={bodyR1}")

scR2, bodyR2 = call("POST", "/weather", json={"citta": "Roma"})
okR2 = (scR2 == 200 and isinstance(bodyR2, dict) and bodyR2.get("success") is True)
record("R2. POST /api/weather {citta:Roma} → 200 success=true",
       okR2, f"sc={scR2} success={(bodyR2 or {}).get('success')} desc={(bodyR2 or {}).get('descrizione')}")

# SUMMARY
total = len(results)
passed = sum(1 for _, ok, _ in results if ok)
print("\n" + "=" * 70)
print(f"RESULT: {passed}/{total} checks passed")
print("=" * 70)
for name, ok, detail in results:
    if not ok:
        print(f"  FAIL: {name} :: {detail}")

sys.exit(0 if passed == total else 1)
