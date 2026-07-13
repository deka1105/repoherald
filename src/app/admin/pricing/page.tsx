import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { discountCodes, users } from "@/db/schema";
import { getAllPlans, getClaimCaps, formatCents } from "@/lib/pricing";
import {
  createDiscount,
  deleteDiscount,
  deletePlan,
  savePlan,
  setDiscountActive,
  updateClaimCaps,
} from "@/app/actions/admin-pricing";
import { Header } from "@/components/header";
import { PlanPrice } from "@/components/plan-price";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Pricing — repoherald admin" };

const inputCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm";

export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.isAdmin) notFound();
  const { msg, err } = await searchParams;

  const [plans, caps, codes] = await Promise.all([
    getAllPlans(),
    getClaimCaps(),
    db
      .select({
        id: discountCodes.id,
        code: discountCodes.code,
        kind: discountCodes.kind,
        value: discountCodes.value,
        userId: discountCodes.userId,
        login: users.githubLogin,
        maxRedemptions: discountCodes.maxRedemptions,
        timesRedeemed: discountCodes.timesRedeemed,
        minAmountCents: discountCodes.minAmountCents,
        expiresAt: discountCodes.expiresAt,
        active: discountCodes.active,
        note: discountCodes.note,
      })
      .from(discountCodes)
      .leftJoin(users, eq(users.id, discountCodes.userId))
      .orderBy(desc(discountCodes.createdAt)),
  ]);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 pb-24 md:pb-14">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Pricing &amp; discounts</h1>
          <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
            ← Back to admin
          </Link>
        </div>

        {msg && (
          <p className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
            {msg}
          </p>
        )}
        {err && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {err}
          </p>
        )}

        {/* ---- Sponsorship plans ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sponsorship plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Checkout uses these prices directly (dynamic Stripe price_data) — edits
              take effect immediately, no redeploy. Each plan ends at its day limit or
              star cap, whichever comes first. Leave star cap blank for time-only.
            </p>
            {plans.map((p) => (
              <form
                key={p.id}
                action={savePlan}
                className="grid grid-cols-2 items-end gap-3 rounded-md border p-3 sm:grid-cols-8"
              >
                <input type="hidden" name="id" value={p.id} />
                <div className="space-y-1">
                  <Label className="text-xs">Key</Label>
                  <Input name="key" defaultValue={p.key} className="h-9" />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Label</Label>
                  <Input name="label" defaultValue={p.label} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Days</Label>
                  <Input
                    name="durationDays"
                    type="number"
                    min={1}
                    defaultValue={p.durationDays}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Star cap</Label>
                  <Input
                    name="starsCap"
                    type="number"
                    min={0}
                    defaultValue={p.starsCap ?? ""}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Price ($)</Label>
                  <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={(p.amountCents / 100).toFixed(2)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Disc %</Label>
                  <Input
                    name="discountPercent"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={p.discountPercent}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Order</Label>
                  <Input
                    name="sortOrder"
                    type="number"
                    defaultValue={p.sortOrder}
                    className="h-9"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={p.active}
                    className="size-4"
                  />
                  Active
                </label>
                <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-8">
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    formAction={deletePlan}
                    className="text-destructive"
                  >
                    Delete
                  </Button>
                  <span className="text-sm">
                    <span className="text-muted-foreground">Sells at </span>
                    <PlanPrice
                      amountCents={p.amountCents}
                      discountPercent={p.discountPercent}
                      currency={p.currency}
                    />
                  </span>
                </div>
              </form>
            ))}

            <form
              action={savePlan}
              className="grid grid-cols-2 items-end gap-3 rounded-md border border-dashed p-3 sm:grid-cols-7"
            >
              <div className="space-y-1">
                <Label className="text-xs">Key</Label>
                <Input name="key" placeholder="90d" className="h-9" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Label</Label>
                <Input name="label" placeholder="90 days or 800 stars" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Days</Label>
                <Input name="durationDays" type="number" min={1} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Star cap</Label>
                <Input name="starsCap" type="number" min={0} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Price ($)</Label>
                <Input name="amount" type="number" step="0.01" min={0} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Order</Label>
                <Input name="sortOrder" type="number" defaultValue={0} className="h-9" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked className="size-4" />
                Active
              </label>
              <div className="col-span-2 sm:col-span-7">
                <Button type="submit" size="sm" variant="secondary">
                  Add plan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ---- Star claim limits ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Star claim limits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              How many verified-star credits a single user can claim per day and per
              week. Enforced live on every claim.
            </p>
            <form action={updateClaimCaps} className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Per day</Label>
                <Input
                  name="daily"
                  type="number"
                  min={1}
                  defaultValue={caps.daily}
                  className="h-9 w-28"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Per week</Label>
                <Input
                  name="weekly"
                  type="number"
                  min={1}
                  defaultValue={caps.weekly}
                  className="h-9 w-28"
                />
              </div>
              <Button type="submit" size="sm">
                Save limits
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ---- Discount codes ---- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discount codes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              action={createDiscount}
              className="grid grid-cols-2 items-end gap-3 rounded-md border border-dashed p-3 sm:grid-cols-4"
            >
              <div className="space-y-1">
                <Label className="text-xs">Code</Label>
                <Input name="code" placeholder="LAUNCH20" className="h-9 uppercase" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <select name="kind" className={inputCls} defaultValue="percent">
                  <option value="percent">Percent off (%)</option>
                  <option value="fixed">Fixed off (cents)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Value</Label>
                <Input name="value" type="number" min={1} placeholder="20" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">For user (GitHub login)</Label>
                <Input name="scopeLogin" placeholder="blank = everyone" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max redemptions</Label>
                <Input
                  name="maxRedemptions"
                  type="number"
                  min={1}
                  placeholder="unlimited"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Min order ($)</Label>
                <Input name="minAmount" type="number" step="0.01" min={0} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expires</Label>
                <Input name="expiresAt" type="date" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Note</Label>
                <Input name="note" placeholder="optional" className="h-9" />
              </div>
              <div className="col-span-2 sm:col-span-4">
                <Button type="submit" size="sm" variant="secondary">
                  Create code
                </Button>
                <span className="ml-3 text-xs text-muted-foreground">
                  Percent uses %, fixed uses cents (e.g. 500 = $5.00). Codes at or below
                  Stripe&apos;s {formatCents(50)} minimum are comped free.
                </span>
              </div>
            </form>

            {codes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No discount codes yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs font-medium">
                        {c.code}
                        {c.note && (
                          <span className="block font-sans text-[11px] text-muted-foreground">
                            {c.note}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.kind === "percent"
                          ? `${c.value}% off`
                          : `${formatCents(c.value)} off`}
                        {c.minAmountCents != null && (
                          <span className="block text-[11px] text-muted-foreground">
                            min {formatCents(c.minAmountCents)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.userId ? `@${c.login ?? "unknown"}` : "Global"}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {c.timesRedeemed}
                        {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.expiresAt
                          ? new Date(c.expiresAt).toISOString().slice(0, 10)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.active ? (
                          <span className="text-green-600 dark:text-green-400">Active</span>
                        ) : (
                          <span className="text-muted-foreground">Disabled</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <form action={setDiscountActive}>
                            <input type="hidden" name="id" value={c.id} />
                            <input
                              type="hidden"
                              name="active"
                              value={c.active ? "false" : "true"}
                            />
                            <Button type="submit" size="sm" variant="ghost">
                              {c.active ? "Disable" : "Enable"}
                            </Button>
                          </form>
                          <form action={deleteDiscount}>
                            <input type="hidden" name="id" value={c.id} />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                            >
                              Delete
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
