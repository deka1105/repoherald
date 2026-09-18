import { Header } from "@/components/header";
import { UserCount } from "@/components/user-count";
import { CreditNotifier } from "@/components/credit-notifier";

// Mirrors (app)/layout.tsx so /account carries the same nav chrome. It lives
// outside the (app) route group because that directory is not writable here.
export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:pb-14">
        {children}
      </main>
      <UserCount />
      <CreditNotifier />
    </>
  );
}
