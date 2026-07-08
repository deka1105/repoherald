import { Header } from "@/components/header";
import { UserCount } from "@/components/user-count";
import { CreditNotifier } from "@/components/credit-notifier";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:pb-14">
        {children}
      </main>
      <UserCount />
      <CreditNotifier />
    </>
  );
}
