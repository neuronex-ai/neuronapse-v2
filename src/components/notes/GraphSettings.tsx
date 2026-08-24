import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
    ChevronDown,
    ChevronRight, Maximize,
    Minimize, Settings2, X
} from "lucide-react";
import { useState } from "react";

export interface GraphConfig {
    // Tela
    nodeSize: number;
    linkThickness: number;
    showArrows: boolean;
    textThreshold: number; // Zoom level para mostrar texto

    // Forças
    repulsion: number;     // Charge
    centerForce: number;   // Gravity
    linkDistance: number;  // Distance
    friction: number;      // Estabilidade/Inércia
    performanceMode: boolean;

    // Filtros
    showPatients: boolean;
    showNotes: boolean;
    showTags: boolean;
}

interface GraphSettingsProps {
    config: GraphConfig;
    onChange: (newConfig: GraphConfig) => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
}

const Section = ({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border-b border-white/5 last:border-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center w-full px-4 py-3 text-xs font-bold text-white/80 hover:text-white hover:bg-white/5 transition-colors uppercase tracking-wider"
            >
                {isOpen ? <ChevronDown className="w-3 h-3 mr-2 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 mr-2 text-muted-foreground" />}
                {title}
            </button>
            {isOpen && <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-2 duration-200">{children}</div>}
        </div>
    );
};

export const GraphSettings = ({ config, onChange, isFullscreen, onToggleFullscreen }: GraphSettingsProps) => {
    const [isOpen, setIsOpen] = useState(true);

    const update = (key: keyof GraphConfig, value: any) => {
        onChange({ ...config, [key]: value });
    };

    if (!isOpen) {
        return (
            <div className="absolute top-4 right-4 z-40 flex gap-2">
                <Button size="icon" variant="secondary" onClick={onToggleFullscreen} className="h-9 w-9 rounded-lg bg-[#0A0A0B]/80 backdrop-blur-md border border-white/10 shadow-xl">
                    {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
                <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => setIsOpen(true)}
                    className="h-9 w-9 rounded-lg bg-[#0A0A0B]/80 backdrop-blur-md border border-white/10 shadow-xl"
                >
                    <Settings2 className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="absolute top-4 right-4 bottom-4 z-40 w-[300px] flex flex-col pointer-events-none">
            <div className="pointer-events-auto flex flex-col bg-[#0A0A0B]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-full">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
                    <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Settings2 className="h-3.5 w-3.5" /> Controles
                    </span>
                    <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setIsOpen(false)} className="h-6 w-6 rounded-md hover:bg-white/10">
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <ScrollArea className="flex-1">
                    <div className="flex flex-col">

                        <Section title="Filtros" defaultOpen>
                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">Pacientes</Label>
                                <Switch checked={config.showPatients} onCheckedChange={(v) => update('showPatients', v)} className="scale-75" />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">Notas</Label>
                                <Switch checked={config.showNotes} onCheckedChange={(v) => update('showNotes', v)} className="scale-75" />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">Tags</Label>
                                <Switch checked={config.showTags} onCheckedChange={(v) => update('showTags', v)} className="scale-75" />
                            </div>
                        </Section>

                        <Section title="Tela">
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Tamanho dos Nós</span>
                                        <span>{config.nodeSize}px</span>
                                    </div>
                                    <Slider
                                        value={[config.nodeSize]}
                                        min={2}
                                        max={15}
                                        step={1}
                                        onValueChange={([v]) => update('nodeSize', v)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Espessura Links</span>
                                        <span>{config.linkThickness}px</span>
                                    </div>
                                    <Slider
                                        value={[config.linkThickness]}
                                        min={0.5}
                                        max={5}
                                        step={0.5}
                                        onValueChange={([v]) => update('linkThickness', v)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Exibir Texto (Zoom {'>'} )</span>
                                        <span>{config.textThreshold.toFixed(1)}x</span>
                                    </div>
                                    <Slider
                                        value={[config.textThreshold]}
                                        min={0.5}
                                        max={3.0}
                                        step={0.1}
                                        onValueChange={([v]) => update('textThreshold', v)}
                                    />
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <Label className="text-xs text-muted-foreground">Tela Cheia</Label>
                                    <Button size="icon" variant="ghost" onClick={onToggleFullscreen} className="h-7 w-7 rounded-md hover:bg-white/10">
                                        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </Section>

                        <Section title="Forças (Física)">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">Modo Performance</Label>
                                    <Switch checked={config.performanceMode} onCheckedChange={(v) => update('performanceMode', v)} className="scale-75" />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Repulsão (Espaçamento)</span>
                                        <span>{(Math.abs(config.repulsion) / 1000).toFixed(0)}k</span>
                                    </div>
                                    <Slider
                                        value={[Math.abs(config.repulsion)]}
                                        min={10000}
                                        max={1000000}
                                        step={10000}
                                        onValueChange={([v]) => update('repulsion', -v)}
                                        className="[&_[role=slider]]:bg-rose-500 dark:[&_[role=slider]]:bg-rose-400"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Comprimento dos Elos</span>
                                        <span>{config.linkDistance.toFixed(0)}px</span>
                                    </div>
                                    <Slider
                                        value={[config.linkDistance]}
                                        min={100}
                                        max={5000}
                                        step={100}
                                        onValueChange={([v]) => update('linkDistance', v)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Gravidade Central</span>
                                        <span>{(config.centerForce * 100).toFixed(1)}%</span>
                                    </div>
                                    <Slider
                                        value={[config.centerForce * 100]}
                                        min={0}
                                        max={100}
                                        step={1}
                                        onValueChange={([v]) => update('centerForce', v / 100)}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Estabilidade (Fricção)</span>
                                        <span>{config.friction.toFixed(2)}</span>
                                    </div>
                                    <Slider
                                        value={[config.friction * 100]}
                                        min={20}
                                        max={95}
                                        step={1}
                                        onValueChange={([v]) => update('friction', v / 100)}
                                    />
                                </div>
                            </div>
                        </Section>

                    </div>
                </ScrollArea>
            </div>
        </div>
    );
};
