import { supabase } from "@/integrations/supabase/client";
import type { PersonalNote } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNotionAuth } from "./use-notion-auth";

export interface NotionPage {
    id: string;
    title: string;
    icon: { type: "emoji" | "url"; value: string } | null;
    cover: string | null;
    url: string;
    created_time?: string;
    last_edited_time: string;
    parent_type: string;
    import?: {
        is_imported: boolean;
        imported_note_id: string | null;
        imported_at: string | null;
        import_is_stale: boolean;
    };
}

export interface NotionBlock {
    id: string;
    type: string;
    [key: string]: any;
}

export interface NotionImportResult {
    note: PersonalNote;
    created: boolean;
    unsupported_blocks?: Array<{
        id: string | null;
        type: string;
        block_type?: string | null;
        reason: string;
    }>;
    render_version?: string;
    source: {
        page_id: string;
        title: string;
        url?: string | null;
        last_edited_time?: string | null;
    };
}

const getSessionOrThrow = async () => {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session) throw new Error("Usuario nao autenticado");
    return session;
};

export const useNotionPages = () => {
    const { isConnected } = useNotionAuth();
    const queryClient = useQueryClient();

    const {
        data: pages,
        isLoading,
        error,
        refetch,
    } = useQuery<NotionPage[], Error>({
        queryKey: ["notion-pages"],
        queryFn: async (): Promise<NotionPage[]> => {
            const session = await getSessionOrThrow().catch(() => null);
            if (!session) return [];

            const { data, error } = await supabase.functions.invoke("notion-pages", {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            if (error) {
                console.error("Error fetching Notion pages:", error);
                return [];
            }

            return data?.pages || [];
        },
        enabled: isConnected,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    });

    const fetchPageContent = async (pageId: string): Promise<NotionBlock[]> => {
        const session = await getSessionOrThrow().catch(() => null);
        if (!session) return [];

        const { data, error } = await supabase.functions.invoke(
            `notion-pages?action=content&page_id=${pageId}`,
            {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            }
        );

        if (error) {
            console.error("Error fetching page content:", error);
            return [];
        }

        return data?.blocks || [];
    };

    const updateBlock = async (blockId: string, payload: any): Promise<boolean> => {
        const session = await getSessionOrThrow().catch(() => null);
        if (!session) return false;

        const { error } = await supabase.functions.invoke(
            `notion-pages?action=update-block&block_id=${blockId}`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: payload,
            }
        );

        if (error) {
            console.error("Error updating block:", error);
            return false;
        }

        return true;
    };

    const importPageMutation = useMutation({
        mutationFn: async (pageId: string): Promise<NotionImportResult> => {
            const session = await getSessionOrThrow();

            const { data, error } = await supabase.functions.invoke(
                "notion-pages?action=import-page",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: { page_id: pageId },
                }
            );

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            return data as NotionImportResult;
        },
        onSuccess: (result) => {
            queryClient.setQueriesData<PersonalNote[]>(
                { queryKey: ["personalNotes"] },
                (current = []) => {
                    const noteWithPatient: PersonalNote = { ...result.note, patient_name: undefined };
                    return [
                        noteWithPatient,
                        ...current.filter((note) => note.id !== result.note.id),
                    ].sort(
                        (left, right) =>
                            new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
                    );
                }
            );

            queryClient.invalidateQueries({ queryKey: ["personalNotes"] });
            queryClient.invalidateQueries({ queryKey: ["notion-pages"] });
        },
    });

    return {
        pages: pages || [],
        isLoading,
        isConnected,
        error,
        refetch,
        fetchPageContent,
        updateBlock,
        importPage: importPageMutation.mutateAsync,
        isImportingPage: importPageMutation.isPending,
    };
};
