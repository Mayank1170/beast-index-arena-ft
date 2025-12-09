'use client';

import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import { Keypair } from "@solana/web3.js";
import IDL from "../idl/beast_index_arena_contract.json";


export const useProgram = () => {
    const { connection } = useConnection();
    const wallet = useAnchorWallet();

    const program = useMemo(() => {
        // Create a read-only provider using a dummy wallet
        // This allows fetching data without wallet connection
        const readOnlyWallet = {
            publicKey: Keypair.generate().publicKey,
            signTransaction: async (tx: any) => tx,
            signAllTransactions: async (txs: any) => txs,
        };

        const effectiveWallet = wallet || readOnlyWallet;

        const provider = new AnchorProvider(connection, effectiveWallet as any, {
            commitment: "confirmed",
        });

        return new Program(IDL as any, provider);
    }, [connection, wallet]);

    return program;
};