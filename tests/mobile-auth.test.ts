import { mintMobileToken, verifyMobileToken } from "@/lib/mobile-auth";

const UID = "11111111-2222-3333-4444-555555555555";
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => {
  if (cond) pass++;
  else fail++;
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}`);
};

process.env.AUTH_SECRET = "test-secret-for-verification-only";

const minted = mintMobileToken(UID)!;
ok("mints a token when AUTH_SECRET is set", !!minted?.token);
ok("round-trips to the same user id", verifyMobileToken(minted.token) === UID);
ok("rejects a tampered user id",
   verifyMobileToken(minted.token.replace(UID, "99999999-2222-3333-4444-555555555555")) === null);
ok("rejects a tampered signature",
   verifyMobileToken(minted.token.slice(0, -4) + "AAAA") === null);
ok("rejects a tampered expiry",
   verifyMobileToken(`${Date.now() + 9e9}.${UID}.${minted.token.split(".")[2]}`) === null);
ok("rejects an expired token",
   verifyMobileToken(`${Date.now() - 1000}.${UID}.whatever`) === null);
ok("rejects malformed input", verifyMobileToken("nonsense") === null);
ok("rejects null", verifyMobileToken(null) === null);

// A token minted under a different secret must not verify under ours.
process.env.AUTH_SECRET = "a-completely-different-secret";
ok("rejects a token signed with another secret", verifyMobileToken(minted.token) === null);

// And with no secret at all, nothing is issued or accepted.
delete process.env.AUTH_SECRET;
ok("mints nothing without AUTH_SECRET", mintMobileToken(UID) === null);
ok("verifies nothing without AUTH_SECRET", verifyMobileToken(minted.token) === null);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
