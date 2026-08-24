import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface NotionToken {
    user_id?: string;
    workspace_id?: string;
}

export const useNotionAuth = () => {
    const [isLoading, setIsLoading] = useState(false);
    const queryClient = useQueryClient();

    const { data: token, isLoading: isChecking } = useQuery({
        queryKey: ['notion-token'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('user_notion_tokens')
                .select('user_id, workspace_id')
                .eq('user_id', user.id)
                .single();

            if (error) return null; // No token found
            return data as NotionToken;
        }
    });

    const isConnected = !!token;

    const connectNotion = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error("Você precisa estar logado.");
                return;
            }

            const { data, error } = await supabase.functions.invoke('notion-auth-init', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            if (error) throw error;
            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error("URL de autenticação não retornada");
            }

        } catch (error: any) {
            console.error("Erro ao iniciar autenticação Notion:", error);
            toast.error("Erro ao conectar com Notion.");
        } finally {
            setIsLoading(false);
        }
    };

    const disconnectNotion = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('user_notion_tokens')
                .delete()
                .eq('user_id', user.id);

            if (error) throw error;

            queryClient.invalidateQueries({ queryKey: ['notion-token'] });
            toast.success("Notion desconectado.");

        } catch (error) {
            console.error(error);
            toast.error("Erro ao desconectar.");
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isConnected,
        workspaceId: token?.workspace_id,
        isLoading: isLoading || isChecking,
        connectNotion,
        disconnectNotion
    };
};
