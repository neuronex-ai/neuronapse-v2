import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileSynapseVoicePanel } from "./MobileSynapsePrimitives";

vi.mock("@/components/ai-chat/VoiceSpiral", () => ({
  VoiceSpiral: () => <div data-testid="voice-spiral" />,
}));

describe("MobileSynapseVoicePanel", () => {
  it("prioritizes tool execution over listening copy", () => {
    render(
      <MobileSynapseVoicePanel
        isConnected
        isListening
        isProcessing
        isSpeaking={false}
        isToolActive
        activeToolLabel="agenda"
        activeToolMessage="Consultando agenda no sistema..."
        lastResponse=""
        onToggleRecording={() => undefined}
        onReset={() => undefined}
      />,
    );

    expect(screen.getByText("Consultando")).toBeInTheDocument();
    expect(screen.getByText("Consultando agenda no sistema...")).toBeInTheDocument();
    expect(screen.queryByText("Ouvindo")).not.toBeInTheDocument();
  });
});
