'use client';

import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import IDL from "../idl/beast_index_arena_contract.json";


export const useProgram = () => {
    const { connection } = useConnection();
    const wallet = useAnchorWallet();

    const program = useMemo(() => {
        if (!wallet) return null;
        const provider = new AnchorProvider(connection, wallet, {
            commitment: "confirmed",
        })

        return new Program(IDL as any, provider);
    }, [connection, wallet])

    return program;
};