import { NotionIcon } from "@/components/icons/NotionIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotionBlock, useNotionPages } from "@/hooks/use-notion-pages";
import { useNotionAuth } from "@/hooks/use-notion-auth";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
    AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Clock, Database, Download, ExternalLink, FileText, Loader2, RefreshCw, Search, Table2, Video
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Notion Block Renderer ─────────────────────────────────────

const NOTION_PAGE_BATCH_SIZE = 40;

function extractRichText(richTextArray: any[]): string {
    if (!richTextArray || !Array.isArray(richTextArray)) return "";
    return richTextArray.map((rt: any) => rt.plain_text || "").join("");
}

function EditableText({
    initialText,
    onSave,
    className
}: {
    initialText: any[],
    onSave: (text: string) => void,
    className?: string
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(extractRichText(initialText));

    if (isEditing) {
        return (
            <textarea
                autoFocus
                className={cn("w-full bg-transparent border-none focus:ring-0 p-0 resize-none font-inherit", className)}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => {
                    setIsEditing(false);
                    if (text !== extractRichText(initialText)) onSave(text);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.currentTarget.blur();
                    }
                }}
            />
        );
    }

    return (
        <div
            onClick={() => setIsEditing(true)}
            className={cn("cursor-text hover:bg-foreground/5 rounded px-0.5 -mx-0.5 transition-colors", className)}
        >
            <RichTextSpan richText={initialText} />
        </div>
    );
}

function RichTextSpan({ richText }: { richText: any[] }) {
    if (!richText || !Array.isArray(richText)) return null;
    return (
        <>
            {richText.map((rt: any, i: number) => {
                let el: React.ReactNode = rt.plain_text || "";
                if (rt.annotations?.bold) el = <strong key={i}>{el}</strong>;
                if (rt.annotations?.italic) el = <em key={i}>{el}</em>;
                if (rt.annotations?.strikethrough) el = <s key={i}>{el}</s>;
                if (rt.annotations?.underline) el = <u key={i}>{el}</u>;
                if (rt.annotations?.code)
                    el = (
                        <code
                            key={i}
                            className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[12px] font-mono"
                        >
                            {el}
                        </code>
                    );
                if (rt.href)
                    el = (
                        <a
                            key={i}
                            href={rt.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                        >
                            {el}
                        </a>
                    );
                return <span key={i}>{el}</span>;
            })}
        </>
    );
}

function NotionBlockRenderer({
    block,
    onUpdate
}: {
    block: NotionBlock,
    onUpdate?: (blockId: string, payload: any) => void
}) {
    const type = block.type;
    const data = block[type];
    const children = (block.children as NotionBlock[]) || [];

    const handleTextUpdate = (newText: string) => {
        onUpdate?.(block.id, {
            [type]: {
                rich_text: [{ text: { content: newText } }]
            }
        });
    };

    const renderChildren = () => {
        if (!children.length) return null;
        return (
            <div className="space-y-1 mt-1">
                {children.map((child) => (
                    <NotionBlockRenderer key={child.id} block={child} onUpdate={onUpdate} />
                ))}
            </div>
        );
    };

    switch (type) {
        case "paragraph":
            if (!data?.rich_text?.length && !children.length) return <div className="h-4" />;
            return (
                <div className="group relative">
                    <p className="text-[14px] leading-[1.8] text-foreground/85 font-normal">
                        <EditableText initialText={data.rich_text} onSave={handleTextUpdate} />
                    </p>
                    {renderChildren()}
                </div>
            );
        case "heading_1":
            return (
                <div className="mt-8 mb-4">
                    <h1 className="text-[26px] font-bold text-foreground tracking-tight">
                        <EditableText initialText={data.rich_text} onSave={handleTextUpdate} />
                    </h1>
                    {renderChildren()}
                </div>
            );
        case "heading_2":
            return (
                <div className="mt-6 mb-3">
                    <h2 className="text-[20px] font-bold text-foreground tracking-tight">
                        <EditableText initialText={data.rich_text} onSave={handleTextUpdate} />
                    </h2>
                    {renderChildren()}
                </div>
            );
        case "heading_3":
            return (
                <div className="mt-4 mb-2">
                    <h3 className="text-[16px] font-bold text-foreground tracking-tight">
                        <EditableText initialText={data.rich_text} onSave={handleTextUpdate} />
                    </h3>
                    {renderChildren()}
                </div>
            );
        case "heading_4":
            return (
                <div className="mt-3 mb-2">
                    <h4 className="text-[14px] font-black uppercase tracking-[0.16em] text-foreground/75">
                        <EditableText initialText={data.rich_text} onSave={handleTextUpdate} />
                    </h4>
                    {renderChildren()}
                </div>
            );
        case "bulleted_list_item":
            return (
                <div className="ml-5 group relative">
                    <li className="text-[14px] leading-[1.8] text-foreground/85 list-disc">
                        <EditableText initialText={data.rich_text} onSave={handleTextUpdate} />
                    </li>
                    {renderChildren()}
                </div>
            );
        case "numbered_list_item":
            return (
                <div className="ml-5 group relative">
                    <li className="text-[14px] leading-[1.8] text-foreground/85 list-decimal">
                        <EditableText initialText={data.rich_text} onSave={handleTextUpdate} />
                    </li>
                    {renderChildren()}
                </div>
            );
        case "to_do":
            return (
                <div className="group relative mb-1">
                    <div className="flex items-start gap-3 text-[14px] leading-[1.8]">
                        <button
                            onClick={() => onUpdate?.(block.id, { to_do: { checked: !data.checked } })}
                            className={cn(
                                "mt-[5px] flex-shrink-0 w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all hover:scale-105 active:scale-95",
                                data.checked
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-muted-foreground/30 hover:border-primary/50"
                            )}
                        >
                            {data.checked && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path
                                        d="M2 5L4 7L8 3"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            )}
                        </button>
                        <span className={cn(data.checked && "line-through opacity-50 transition-opacity")}>
                            <EditableText initialText={data.rich_text} onSave={handleTextUpdate} />
                        </span>
                    </div>
                    <div className="ml-7">{renderChildren()}</div>
                </div>
            );
        case "toggle":
            return (
                <details className="group my-2 ml-1">
                    <summary className="text-[14px] font-semibold cursor-pointer list-none flex items-center gap-2 text-foreground hover:text-primary transition-colors outline-none">
                        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90 text-muted-foreground" />
                        <EditableText initialText={data.rich_text} onSave={handleTextUpdate} />
                    </summary>
                    <div className="ml-3 border-l border-border/20 pl-4 py-1">
                        {renderChildren()}
                    </div>
                </details>
            );
        case "column_list":
            return (
                <div className="flex flex-col md:flex-row gap-8 my-6 w-full">
                    {children.map((col) => (
                        <div key={col.id} className="flex-1 min-w-0">
                            <NotionBlockRenderer block={col} onUpdate={onUpdate} />
                        </div>
                    ))}
                </div>
            );
        case "column":
            return <div className="space-y-1">{renderChildren()}</div>;
        case "quote":
            return (
                <div className="my-4">
                    <blockquote className="pl-4 border-l-[3px] border-primary/40 italic text-[15px] leading-[1.8] text-foreground/70">
                        <EditableText initialText={data.rich_text} onSave={handleTextUpdate} />
                    </blockquote>
                    {renderChildren()}
                </div>
            );
        case "callout":
            return (
                <div className="my-4 p-4 rounded-2xl bg-muted/40 border border-border/50 flex items-start gap-3">
                    {data.icon?.emoji && <span className="text-xl shrink-0 mt-0.5">{data.icon.emoji}</span>}
                    <div className="text-[14px] leading-[1.8] text-foreground/85 flex-1">
                        <EditableText initialText={data.rich_text} onSave={handleTextUpdate} />
                        {renderChildren()}
                    </div>
                </div>
            );
        case "code":
            return (
                <div className="my-6">
                    <pre className="p-5 rounded-2xl bg-zinc-950 text-zinc-100 text-[13px] font-mono overflow-x-auto border border-white/5 shadow-2xl">
                        <div className="flex justify-between items-center mb-3 opacity-50 text-[10px] uppercase tracking-widest">
                            <span>{data.language}</span>
                        </div>
                        <code>{extractRichText(data.rich_text)}</code>
                    </pre>
                    {renderChildren()}
                </div>
            );
        case "divider":
            return <hr className="border-border/40 my-8" />;
        case "image": {
            const imgUrl = data?.file?.url || data?.external?.url;
            if (!imgUrl) return null;
            return (
                <div className="my-8 group relative rounded-2xl overflow-hidden border border-border/30 shadow-sm transition-shadow hover:shadow-md">
                    <img src={imgUrl} alt="" className="w-full object-cover max-h-[600px]" />
                    {data.caption?.length > 0 && (
                        <div className="bg-muted/50 px-4 py-2 border-t border-border/30">
                            <p className="text-[11px] text-muted-foreground text-center italic">
                                <RichTextSpan richText={data.caption} />
                            </p>
                        </div>
                    )}
                </div>
            );
        }
        case "bookmark": {
            const bookmarkUrl = data?.url;
            if (!bookmarkUrl) return null;
            return (
                <div className="my-4">
                    <a
                        href={bookmarkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 hover:bg-muted/50 hover:border-primary/30 transition-all group"
                    >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <ExternalLink className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-foreground truncate">{bookmarkUrl}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Link externo</p>
                        </div>
                    </a>
                    {renderChildren()}
                </div>
            );
        }
        case "embed":
        case "link_preview": {
            const externalUrl = data?.url;
            if (!externalUrl) return null;
            return (
                <div className="my-4 rounded-2xl border border-border/50 bg-card/80 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <ExternalLink className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[12px] font-black uppercase tracking-[0.14em] text-foreground">
                                {type === "embed" ? "Embed" : "Preview de link"}
                            </p>
                            <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-[12px] text-muted-foreground hover:text-primary">
                                {externalUrl}
                            </a>
                        </div>
                    </div>
                    {renderChildren()}
                </div>
            );
        }
        case "video":
        case "audio":
        case "file":
        case "pdf": {
            const fileUrl = data?.file?.url || data?.external?.url || data?.url;
            const label = type === "video" ? "Video" : type === "audio" ? "Audio" : type === "pdf" ? "PDF" : "Arquivo";
            return (
                <div className="my-4 rounded-2xl border border-border/50 bg-card/80 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            {type === "video" ? <Video className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-black uppercase tracking-[0.14em] text-foreground">{label} do Notion</p>
                            {fileUrl ? (
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-[12px] text-muted-foreground hover:text-primary">
                                    Abrir origem
                                </a>
                            ) : (
                                <p className="text-[12px] text-muted-foreground">URL indisponivel no payload.</p>
                            )}
                        </div>
                    </div>
                    {data?.caption?.length > 0 && (
                        <p className="mt-3 text-[11px] italic text-muted-foreground">
                            <RichTextSpan richText={data.caption} />
                        </p>
                    )}
                    {renderChildren()}
                </div>
            );
        }
        case "table":
            return (
                <div className="my-5 overflow-hidden rounded-2xl border border-border/50 bg-card/70">
                    <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        <Table2 className="h-4 w-4" />
                        Tabela do Notion
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[12px]">
                            <tbody>
                                {children.map((row) => (
                                    <tr key={row.id} className="border-b border-border/30 last:border-0">
                                        {(row.table_row?.cells || []).map((cell: any[], index: number) => (
                                            <td key={index} className="min-w-32 px-4 py-3 text-foreground/80">
                                                <RichTextSpan richText={cell} />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        case "child_database":
        case "child_page":
            return (
                <div className="my-4 rounded-2xl border border-border/50 bg-muted/30 p-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            {type === "child_database" ? <Database className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                        </div>
                        <div>
                            <p className="text-[12px] font-black uppercase tracking-[0.14em] text-foreground">
                                {type === "child_database" ? "Banco do Notion" : "Subpagina do Notion"}
                            </p>
                            <p className="text-[12px] text-muted-foreground">{data?.title || "Referencia vinculada"}</p>
                        </div>
                    </div>
                    {renderChildren()}
                </div>
            );
        case "equation":
            return (
                <pre className="my-4 overflow-x-auto rounded-2xl border border-border/50 bg-muted/50 p-4 text-[13px]">
                    <code>{data?.expression || ""}</code>
                </pre>
            );
        case "synced_block":
        case "template":
        case "transcription":
        case "meeting_notes":
            return (
                <div className="my-4 rounded-2xl border border-border/50 bg-muted/30 p-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                        {type === "synced_block" ? "Bloco sincronizado" : type === "template" ? "Template" : "Notas de reuniao"}
                    </p>
                    {renderChildren() || <p className="text-[12px] text-muted-foreground">Sem conteudo filho retornado.</p>}
                </div>
            );
        case "unsupported":
        default:
            return (
                <div className="my-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-amber-700 dark:text-amber-300">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <div>
                            <p className="text-[12px] font-black uppercase tracking-[0.14em]">Bloco Notion preservado</p>
                            <p className="text-[12px] opacity-80">{data?.block_type || type} sera mantido no payload bruto.</p>
                        </div>
                    </div>
                    {renderChildren()}
                </div>
            );
    }
}

// ─── Main Component ─────────────────────────────────────────────

interface NotionPagesPanelProps {
    onSelectNotionPage?: (pageId: string | null) => void;
    selectedPageId?: string | null;
    onImportedNote?: (noteId: string) => void;
}

export const NotionPagesPanel = ({
    onSelectNotionPage,
    selectedPageId,
    onImportedNote,
}: NotionPagesPanelProps) => {
    const { pages, isLoading, isConnected, refetch, fetchPageContent, updateBlock, importPage, isImportingPage } = useNotionPages();
    const { connectNotion, isLoading: isAuthLoading } = useNotionAuth();
    const [viewingPage, setViewingPage] = useState<{
        id: string;
        title: string;
        icon: any;
        url: string;
        import?: {
            is_imported: boolean;
            imported_note_id: string | null;
            imported_at: string | null;
            import_is_stale: boolean;
        };
    } | null>(null);
    const [blocks, setBlocks] = useState<NotionBlock[]>([]);
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [importingPageId, setImportingPageId] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(NOTION_PAGE_BATCH_SIZE);

    const handleOpenPage = useCallback(
        async (page: any) => {
            setViewingPage(page);
            setIsLoadingContent(true);
            try {
                const content = await fetchPageContent(page.id);
                setBlocks(content);
            } catch (e) {
                console.error(e);
                setBlocks([]);
            } finally {
                setIsLoadingContent(false);
            }
            onSelectNotionPage?.(page.id);
        },
        [fetchPageContent, onSelectNotionPage]
    );

    const handleUpdateBlock = async (blockId: string, payload: any) => {
        // Optimistic update
        const updatedBlocks = JSON.parse(JSON.stringify(blocks));
        const updateInList = (list: NotionBlock[]) => {
            for (const b of list) {
                if (b.id === blockId) {
                    Object.assign(b, payload);
                    return true;
                }
                if (b.children && updateInList(b.children)) return true;
            }
            return false;
        };
        updateInList(updatedBlocks);
        setBlocks(updatedBlocks);

        const success = await updateBlock(blockId, payload);
        if (!success) {
            // Revert on failure
            const content = await fetchPageContent(viewingPage!.id);
            setBlocks(content);
        }
    };

    const handleBack = () => {
        setViewingPage(null);
        setBlocks([]);
        onSelectNotionPage?.(null);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setIsRefreshing(false);
    };

    const handleImportPage = useCallback(
        async (page: { id: string; title?: string }) => {
            setImportingPageId(page.id);
            try {
                const result = await importPage(page.id);
                toast.success(result.created ? "Página importada como nota." : "Nota do Notion atualizada.");
                if (result.unsupported_blocks?.length) {
                    toast.info(`${result.unsupported_blocks.length} bloco(s) foram preservados como fallback.`);
                }
                onImportedNote?.(result.note.id);
            } catch (error) {
                console.error("Falha ao importar página do Notion:", error);
                toast.error("Não foi possível importar esta página.");
            } finally {
                setImportingPageId(null);
            }
        },
        [importPage, onImportedNote]
    );

    useEffect(() => {
        setVisibleCount(NOTION_PAGE_BATCH_SIZE);
    }, [searchQuery, pages.length]);

    const filteredPages = useMemo(
        () => pages.filter((p) => p.title.toLowerCase().includes(searchQuery.toLowerCase())),
        [pages, searchQuery]
    );

    const visiblePages = useMemo(
        () => filteredPages.slice(0, visibleCount),
        [filteredPages, visibleCount]
    );

    // ─── Not Connected State ─────────────────────────────────
    if (!isConnected) {
        return (
            <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                >
                    <div className="relative mx-auto w-20 h-20">
                        <div className="absolute inset-0 bg-foreground/5 rounded-3xl blur-2xl animate-pulse" />
                        <div className="relative w-20 h-20 rounded-3xl bg-background border border-border/50 flex items-center justify-center shadow-xl">
                            <NotionIcon className="h-9 w-9 text-foreground/70" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-bold tracking-tight">Notion</h3>
                        <p className="text-[13px] text-muted-foreground max-w-[260px] leading-relaxed">
                            Conecte sua conta do Notion para importar e visualizar suas páginas
                            diretamente aqui.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={connectNotion}
                        disabled={isAuthLoading}
                        className="rounded-xl font-bold gap-2"
                    >
                        {isAuthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <NotionIcon className="h-4 w-4" />}
                        Conectar Notion
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </motion.div>
            </div>
        );
    }

    // ─── Page Content View ───────────────────────────────────
    if (viewingPage) {
        return (
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="flex flex-col h-full"
            >
                {/* Reader Header */}
                <div className="shrink-0 px-6 py-4 border-b border-border/40 bg-background/60 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={handleBack}
                                className="h-8 w-8 rounded-xl hover:bg-muted"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div className="flex items-center gap-2.5">
                                {viewingPage.icon?.type === "emoji" ? (
                                    <span className="text-xl">{viewingPage.icon.value}</span>
                                ) : (
                                    <NotionIcon className="h-5 w-5 text-foreground/60" />
                                )}
                                <h2 className="text-[15px] font-bold tracking-tight truncate max-w-[400px]">
                                    {viewingPage.title}
                                </h2>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={viewingPage.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Abrir no Notion
                            </a>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => void handleImportPage(viewingPage)}
                                disabled={isImportingPage && importingPageId === viewingPage.id}
                                className="h-9 rounded-xl bg-foreground px-3 text-[10px] font-black uppercase tracking-[0.16em] text-background hover:bg-foreground/90 dark:bg-white dark:text-zinc-950"
                            >
                                {isImportingPage && importingPageId === viewingPage.id ? (
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Download className="mr-2 h-3.5 w-3.5" />
                                )}
                                {viewingPage.import?.is_imported ? "Atualizar nota" : "Importar"}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Reader Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="max-w-[720px] mx-auto px-8 py-10">
                        {isLoadingContent ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                <p className="text-[12px] text-muted-foreground font-medium">
                                    Carregando conteúdo...
                                </p>
                            </div>
                        ) : blocks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                                <BookOpen className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.5} />
                                <div>
                                    <p className="text-[13px] font-semibold text-muted-foreground">
                                        Página vazia
                                    </p>
                                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                                        Esta página não possui conteúdo visível.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {blocks.map((block) => (
                                    <NotionBlockRenderer
                                        key={block.id}
                                        block={block}
                                        onUpdate={handleUpdateBlock}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.2); border-radius: 20px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        `}</style>
            </motion.div>
        );
    }

    // ─── Pages List View ─────────────────────────────────────
    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="shrink-0 px-6 py-5 pb-4">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-foreground/5 dark:bg-white/5 flex items-center justify-center">
                            <NotionIcon className="h-5 w-5 text-foreground/70" />
                        </div>
                        <div className="space-y-0.5">
                            <h2 className="text-[15px] font-bold tracking-tight text-foreground">
                                Notion
                            </h2>
                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                                {pages.length} página{pages.length !== 1 ? "s" : ""}
                            </p>
                        </div>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="h-8 w-8 rounded-xl border border-border/45 bg-background/35 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    >
                        <RefreshCw
                            className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                        />
                    </Button>
                </div>

                {/* Search */}
                <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <Search className="h-3.5 w-3.5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
                    </div>
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar páginas..."
                        className="w-full pl-9 h-10 bg-background/55 border-border/45 rounded-xl text-[13px] font-medium focus-visible:ring-1 focus-visible:ring-primary/25 focus-visible:bg-background/80 transition-all placeholder:text-muted-foreground/50 hover:bg-muted/50 border outline-none px-3 text-foreground"
                    />
                </div>
            </div>

            {/* Pages List */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 custom-scrollbar [scrollbar-gutter:stable]">
                {isLoading ? (
                    <div className="space-y-3 pt-2">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="h-20 rounded-2xl bg-muted/40 animate-pulse"
                                style={{ animationDelay: `${i * 100}ms` }}
                            />
                        ))}
                    </div>
                ) : filteredPages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center space-y-3 opacity-50 px-6">
                        <FileText className="h-6 w-6 text-muted-foreground" strokeWidth={1} />
                        <p className="text-[11px] font-medium text-muted-foreground">
                            {searchQuery
                                ? "Nenhuma página encontrada."
                                : "Nenhuma página importada."}
                        </p>
                    </div>
                ) : (
                    <>
                        {visiblePages.map((page) => (
                            <div
                                key={page.id}
                                onClick={() => handleOpenPage(page)}
                                className={cn(
                                    "group relative rounded-2xl cursor-pointer transition-colors duration-200 border overflow-hidden [content-visibility:auto] [contain-intrinsic-size:88px]",
                                    selectedPageId === page.id
                                        ? "notes-liquid-surface border-border/65 z-10"
                                        : "border-border/0 bg-background/[0.18] hover:bg-card/72 hover:border-border/45"
                                )}
                            >
                                {/* Cover image strip */}
                                {page.cover && (
                                    <div className="h-[72px] w-full overflow-hidden">
                                        <img
                                            src={page.cover}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
                                    </div>
                                )}

                                <div
                                    className={cn(
                                        "p-4 flex items-start gap-3.5",
                                        page.cover && "-mt-3 relative z-10"
                                    )}
                                >
                                    {/* Icon */}
                                    <div
                                        className={cn(
                                            "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                                            page.cover
                                                ? "bg-background border border-border/50 shadow-md"
                                                : "bg-muted/50 group-hover:bg-muted"
                                        )}
                                    >
                                        {page.icon?.type === "emoji" ? (
                                            <span className="text-xl leading-none">
                                                {page.icon.value}
                                            </span>
                                        ) : page.icon?.type === "url" ? (
                                            <img
                                                src={page.icon.value}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                className="w-5 h-5 object-contain"
                                            />
                                        ) : (
                                            <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <h3 className="line-clamp-1 min-w-0 flex-1 text-[13px] font-semibold leading-snug tracking-tight text-foreground/90 transition-colors group-hover:text-foreground">
                                                {page.title}
                                            </h3>
                                            {page.import?.is_imported && (
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "h-5 shrink-0 rounded-full border px-2 text-[8px] font-black uppercase tracking-[0.12em]",
                                                        page.import.import_is_stale
                                                            ? "border-amber-400/30 bg-amber-400/10 text-amber-500"
                                                            : "border-emerald-400/25 bg-emerald-400/10 text-emerald-500"
                                                    )}
                                                >
                                                    {page.import.import_is_stale ? "Atualizar" : "Importada"}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-medium">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                                {formatDistanceToNow(
                                                    new Date(page.last_edited_time),
                                                    { addSuffix: true, locale: ptBR }
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={isImportingPage && importingPageId === page.id}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            void handleImportPage(page);
                                        }}
                                        className="h-8 shrink-0 rounded-xl px-2.5 text-[9px] font-black uppercase tracking-[0.14em]"
                                    >
                                        {isImportingPage && importingPageId === page.id ? (
                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                        )}
                                        {page.import?.is_imported ? "Atualizar" : "Importar"}
                                    </Button>

                                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-all group-hover:translate-x-0.5 shrink-0 mt-0.5" />
                                </div>

                                {/* Active indicator */}
                                {selectedPageId === page.id && (
                                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full shadow-[0_0_18px_hsl(var(--primary)/0.45)]" />
                                )}
                            </div>
                        ))}
                        {visibleCount < filteredPages.length && (
                            <div className="px-1 pt-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setVisibleCount((current) => Math.min(current + NOTION_PAGE_BATCH_SIZE, filteredPages.length))}
                                    className="notes-liquid-surface h-11 w-full rounded-xl border text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
                                >
                                    Carregar mais {Math.min(NOTION_PAGE_BATCH_SIZE, filteredPages.length - visibleCount)} paginas
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.2); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
        </div>
    );
};
