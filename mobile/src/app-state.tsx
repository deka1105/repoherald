/**
 * App-wide state that has no screen of its own: the device's block list, and
 * the two sheets that can be summoned from anywhere.
 *
 * Both sheets live at the root rather than inside each screen. Sign-in can be
 * reached from the repo screen, the lists tab, the wallet and the account tab;
 * reporting can be reached from every card in three different lists. Mounting
 * one copy of each here means a screen only has to ask, and the sheet is never
 * fighting a navigation transition for the same bit of UI.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { SignInSheet } from "@/signin";
import { ModerationSheet } from "@/moderation";
import { isBlocked, loadBlocked } from "@/blocks";
import type { RepoSummary } from "@/api";

type AppState = {
  /** Owner logins this device has blocked, lower-cased. */
  blocked: string[];
  setBlocked: (next: string[]) => void;
  /** True when a listing's owner is on this device's block list. */
  hidden: (fullName: string) => boolean;
  promptSignIn: () => void;
  moderate: (repo: RepoSummary) => void;
};

const Ctx = createContext<AppState | null>(null);

export function useAppState() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAppState outside AppStateProvider");
  return v;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState<string[]>([]);
  const [signingIn, setSigningIn] = useState(false);
  const [moderating, setModerating] = useState<RepoSummary | null>(null);

  // Read once at launch; every later change comes back through the sheets, so
  // no screen ever has to hit the disk again.
  useEffect(() => {
    loadBlocked().then(setBlocked).catch(() => {});
  }, []);

  const value = useMemo<AppState>(
    () => ({
      blocked,
      setBlocked,
      hidden: (fullName: string) => isBlocked(fullName, blocked),
      promptSignIn: () => setSigningIn(true),
      moderate: (repo: RepoSummary) => setModerating(repo),
    }),
    [blocked]
  );

  const closeSignIn = useCallback(() => setSigningIn(false), []);
  const closeModeration = useCallback(() => setModerating(null), []);

  return (
    <Ctx.Provider value={value}>
      {children}
      <SignInSheet visible={signingIn} onClose={closeSignIn} />
      <ModerationSheet
        repo={moderating}
        onClose={closeModeration}
        onBlocked={setBlocked}
      />
    </Ctx.Provider>
  );
}
