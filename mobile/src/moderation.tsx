/**
 * Report and block, for a single listing.
 *
 * App Store Guideline 1.2: an app that shows user-submitted content needs a
 * way to report that content and a way to block the people posting it. The
 * feed is populated by users, so both belong here.
 *
 * Neither action requires an account, because browsing does not. Reports go to
 * the moderation queue; blocks stay on the device (see ./blocks).
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { REPORT_REASONS, reportRepo, type RepoSummary, type ReportReason } from "./api";
import { blockOwner } from "./blocks";
import { C, ANDROID_TOP_INSET } from "./theme";

type Step = "menu" | "reasons" | "reported" | "blocked";

export function ModerationSheet({
  repo,
  onClose,
  onBlocked,
}: {
  repo: RepoSummary | null;
  onClose: () => void;
  /**
   * Receives the canonical list straight from the store, not the owner string.
   * `blockOwner` lower-cases and de-duplicates; passing the raw owner back
   * instead would put mixed case into the in-memory list, and `isBlocked`
   * compares against lower-cased names, so the block would silently not apply.
   */
  onBlocked: (blocked: string[]) => void;
}) {
  const [step, setStep] = useState<Step>("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const owner = repo ? (repo.fullName.split("/")[0] ?? repo.fullName) : "";

  const close = () => {
    onClose();
    // Reset after the sheet is gone, so the menu does not flicker on the way out.
    setTimeout(() => {
      setStep("menu");
      setBusy(false);
      setError(null);
    }, 250);
  };

  const submitReport = async (reason: ReportReason) => {
    if (!repo || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reportRepo(repo.id, reason);
      setStep("reported");
    } catch {
      setError("Couldn't send that report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const doBlock = async () => {
    if (!repo || busy) return;
    setBusy(true);
    setError(null);
    try {
      onBlocked(await blockOwner(owner));
      setStep("blocked");
    } catch {
      setError("Couldn't block that account. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={repo !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}>
      <View style={styles.root}>
        <View style={styles.bar}>
          <Text style={styles.title}>
            {step === "reasons" ? "Report this repo" : "Options"}
          </Text>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}>
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {repo ? (
            <Text style={styles.subject} numberOfLines={2}>
              {repo.fullName}
            </Text>
          ) : null}

          {step === "menu" ? (
            <>
              <Pressable
                style={styles.action}
                onPress={() => setStep("reasons")}
                accessibilityRole="button"
                accessibilityLabel="Report this repo">
                <Text style={styles.actionText}>Report this repo</Text>
                <Text style={styles.actionHint}>
                  Sends it to a moderator for review.
                </Text>
              </Pressable>

              <Pressable
                style={styles.action}
                onPress={doBlock}
                accessibilityRole="button"
                accessibilityLabel={`Block ${owner}`}>
                <Text style={[styles.actionText, { color: C.danger }]}>
                  Block {owner}
                </Text>
                <Text style={styles.actionHint}>
                  Hides everything from this account in your feed. You can undo
                  this in Account.
                </Text>
              </Pressable>
            </>
          ) : null}

          {step === "reasons" ? (
            <>
              <Text style={styles.heading}>What is wrong with it?</Text>
              {REPORT_REASONS.map((r) => (
                <Pressable
                  key={r.key}
                  style={styles.action}
                  disabled={busy}
                  onPress={() => submitReport(r.key)}
                  accessibilityRole="button"
                  accessibilityLabel={r.label}>
                  <Text style={styles.actionText}>{r.label}</Text>
                </Pressable>
              ))}
            </>
          ) : null}

          {step === "reported" ? (
            <Text style={styles.result}>
              Thank you. A moderator will look at this listing. You can also
              block this account from the Options menu if you would rather not
              see it again.
            </Text>
          ) : null}

          {step === "blocked" ? (
            <Text style={styles.result}>
              Blocked. Nothing from {owner} will appear in your feed. You can
              unblock them at any time from Account.
            </Text>
          ) : null}

          {busy ? <ActivityIndicator color={C.accent} style={{ marginTop: 20 }} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: ANDROID_TOP_INSET },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  title: { color: C.text, fontSize: 18, fontWeight: "700" },
  close: { color: C.accent, fontSize: 16, fontWeight: "600" },
  body: {
    padding: 20,
    paddingBottom: 48,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  subject: { color: C.dim, fontSize: 14, marginBottom: 18 },
  heading: {
    color: C.dim,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  action: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  actionText: { color: C.text, fontSize: 16, fontWeight: "600" },
  actionHint: { color: C.dim, fontSize: 13, lineHeight: 19, marginTop: 4 },
  result: { color: C.body, fontSize: 15, lineHeight: 22, marginTop: 4 },
  error: { color: C.danger, fontSize: 14, marginTop: 16 },
});
