"use client";

import DesktopDashboardClinicalFlowV4 from "@/components/dashboard/desktop/DesktopDashboardClinicalFlowV4";
import { DashboardSynapseWebGLBackdrop } from "@/components/dashboard/desktop/DashboardSynapseWebGLBackdrop";
import "@/styles/dashboard-clinical-flow-v4.css";
import "@/styles/dashboard-clinical-flow-v4-tuning.css";

const DesktopDashboard = () => (
  <div className="dashboard-clinical-flow-v4">
    <DesktopDashboardClinicalFlowV4 />
    <DashboardSynapseWebGLBackdrop />
  </div>
);

export default DesktopDashboard;
