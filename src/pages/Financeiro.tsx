import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const DesktopFinanceiro = lazy(() => import("@/pages/desktop/DesktopFinanceiro"));
const MobileFinancialManagementFlow = lazy(() => import("@/mobile/pages/finance/MobileFinancialManagementFlow").then((module) => ({ default: module.MobileFinancialManagementFlow })));
const MobileNeuroFinanceHome = lazy(() => import("@/mobile/pages/finance/MobileNeuroFinanceHome").then((module) => ({ default: module.MobileNeuroFinanceHome })));
const MobileNeuroFinanceFlow = lazy(() => import("@/mobile/pages/finance/MobileNeuroFinanceFlow").then((module) => ({ default: module.MobileNeuroFinanceFlow })));

const PageLoader = () => <div className="flex h-screen w-full items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-foreground/20" /></div>;

const ManagementCore = () => {
  const mobile = useIsMobile();
  return <Suspense fallback={<PageLoader />}>{mobile ? <MobileFinancialManagementFlow /> : <DesktopFinanceiro />}</Suspense>;
};

const NeuroFinanceHomeCore = () => {
  const mobile = useIsMobile();
  return <Suspense fallback={<PageLoader />}>{mobile ? <MobileNeuroFinanceHome /> : <DesktopFinanceiro />}</Suspense>;
};

const BankingFlowCore = () => {
  const mobile = useIsMobile();
  return <Suspense fallback={<PageLoader />}>{mobile ? <MobileNeuroFinanceFlow /> : <DesktopFinanceiro />}</Suspense>;
};

const Financeiro = () => (
  <Routes>
    <Route index element={<ManagementCore />} />
    <Route path="gestao/*" element={<ManagementCore />} />
    <Route path="neurofinance" element={<NeuroFinanceHomeCore />} />
    <Route path="neurofinance/*" element={<BankingFlowCore />} />
    <Route path="*" element={<ManagementCore />} />
  </Routes>
);

export default Financeiro;
