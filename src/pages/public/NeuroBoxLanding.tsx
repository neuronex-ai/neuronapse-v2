import { NeuroBoxGeminiHeroExperiment } from "@/components/public/NeuroBoxGeminiHeroExperiment";
import { CatalogLanding } from "@/pages/public/CatalogLanding";

const NeuroBoxLanding = () => (
  <div className="relative isolate">
    <NeuroBoxGeminiHeroExperiment />
    <CatalogLanding route="/neurobox" />
  </div>
);

export default NeuroBoxLanding;
