/**
 * Legacy endpoint retained only to reject direct Pix transfers.
 * Secure Pix transfers must use asaas-payout consult -> authorize -> execute.
 */

import {
    corsResponse,
    errorResponse,
    getAuthenticatedUser,
} from "../_shared/asaas-client.ts";

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return corsResponse();

    try {
        await getAuthenticatedUser(req);
        return errorResponse("Consulte o destino e confirme a transferência com seu PIN financeiro.", 400, {
            code: "PAYOUT_CONSULTATION_REQUIRED",
        });
    } catch (error: any) {
        console.error("asaas-pix-out error:", error);
        return errorResponse(error?.message || "Não conseguimos validar esta transferência agora.", error?.status || 500, {
            code: error?.code || "PAYOUT_CONSULTATION_REQUIRED",
        });
    }
});
