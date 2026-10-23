/**
 * Wallet — where the balance came from.
 *
 * Read-only, deliberately. Selling a digital currency outside In-App Purchase
 * is a Guideline 3.1.1 rejection, so buying credits stays on the web and the
 * app does not link to it; spending them on highlights is left out with it,
 * so this screen has one honest job rather than half a storefront.
 *
 * Credits are still *earned* here: star a repo on GitHub, claim it on the
 * repo screen, and the entry appears in this ledger.
 */
import React, { useCallback, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ApiError, getWallet, type Wallet } from "@/api";
import { useAuth } from "@/auth";
import { useAppState } from "@/app-state";
import {
  Blurb,
  Button,
  Card,
  ErrorText,
  Heading,
  Loading,
  Notice,
  Row,
  Screen,
  timeAgo,
} from "@/components/ui";
import { C } from "@/theme";

export default function WalletScreen() {
  const { me } = useAuth();
  const { promptSignIn } = useAppState();
  const router = useRouter();

  const [data, setData] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!me) {
      setLoading(false);
      return;
    }
    try {
      setData(await getWallet());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your wallet.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!me) {
    return (
      <Screen>
        <Heading>Wallet</Heading>
        <Blurb>
          Star a repo on GitHub, claim it here, and you earn a credit. Sign in
          to start.
        </Blurb>
        <Button label="Sign in" onPress={promptSignIn} />
      </Screen>
    );
  }

  if (loading) return <Loading />;

  if (!data) {
    return (
      <Screen>
        <ErrorText>{error ?? "Couldn't load your wallet."}</ErrorText>
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={C.dim}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }>
      <Card>
        <Text style={styles.balance}>{data.creditBalance}</Text>
        <Text style={styles.balanceLabel}>
          {data.creditBalance === 1 ? "credit" : "credits"}
        </Text>
      </Card>

      <Row label="Can earn credits" value={data.mintEligible ? "Yes" : "Not yet"} />
      <Row label="Stars claimed" value={data.claims.total} />
      <Row
        label="Claims today"
        value={`${data.claims.today} / ${data.claims.dailyCap}`}
      />
      <Row
        label="Claims this week"
        value={`${data.claims.thisWeek} / ${data.claims.weeklyCap}`}
      />

      <Notice>
        1 verified star earns 1 credit. A credit is worth an hour of
        self-highlight, or fifteen minutes donated to someone else&rsquo;s repo
        — both of which are spent on repoherald.com. Unstarring within 100 days
        takes the credit back.
      </Notice>

      <Heading>Your listings</Heading>
      {data.postedRepos.length === 0 ? (
        <Blurb>You haven&rsquo;t posted a repo yet.</Blurb>
      ) : (
        data.postedRepos.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => router.push(`/repo/${r.id}`)}
            accessibilityRole="button"
            accessibilityLabel={r.fullName}>
            <View style={styles.listingRow}>
              <Text style={styles.listing} numberOfLines={1}>
                {r.fullName}
              </Text>
            </View>
          </Pressable>
        ))
      )}

      <Heading>History</Heading>
      {data.entries.length === 0 ? (
        <Blurb>Nothing yet.</Blurb>
      ) : (
        data.entries.map((e) => (
          <View key={e.id} style={styles.entry}>
            <View style={{ flex: 1 }}>
              <Text style={styles.entryLabel}>{e.label}</Text>
              <Text style={styles.entryWhen}>
                {timeAgo(e.createdAt)}
                {e.memo ? ` · ${e.memo}` : ""}
              </Text>
            </View>
            <Text style={[styles.delta, e.delta < 0 && styles.deltaNeg]}>
              {e.delta > 0 ? `+${e.delta}` : e.delta}
            </Text>
          </View>
        ))
      )}

      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balance: { color: C.text, fontSize: 44, fontWeight: "800", textAlign: "center" },
  balanceLabel: {
    color: C.dim,
    fontSize: 13,
    textAlign: "center",
    marginTop: 2,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  listingRow: {
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  listing: { color: C.accent, fontSize: 15 },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  entryLabel: { color: C.text, fontSize: 15 },
  entryWhen: { color: C.dim, fontSize: 12, marginTop: 3 },
  delta: { color: C.accent, fontSize: 16, fontWeight: "700" },
  deltaNeg: { color: C.dim },
});
