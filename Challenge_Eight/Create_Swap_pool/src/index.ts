import { initializeKeypair } from "./initializeKeypair"
import * as web3 from '@solana/web3.js'
import { TokenSwap, TOKEN_SWAP_PROGRAM_ID, TokenSwapLayout, CurveType } from "@solana/spl-token-swap"
import * as token from "@solana/spl-token"

async function main() {
    const programId = token.TOKEN_PROGRAM_ID
    const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
    const user = await initializeKeypair(connection)
    var tokenAMint = new web3.PublicKey("2zM6hnRBDHku8tnnyWHunAVS8oXafmbfqHr4KNb8pbk8")
    var tokenBMint = new web3.PublicKey("2ba9iDpyafcDJx6RMmddvcbchNK4G1dwB4jW8yTT8Cqf")
    const transaction = new web3.Transaction()
    const tokenSwapStateAccount = web3.Keypair.generate()
    const rent = await TokenSwap.getMinBalanceRentForExemptTokenSwap(connection);
    
    const tokenSwapStateAccountInstruction = await web3.SystemProgram.createAccount({
        newAccountPubkey: tokenSwapStateAccount.publicKey,
        fromPubkey: user.publicKey,
        lamports: rent,
        space: TokenSwapLayout.span,
        programId: TOKEN_SWAP_PROGRAM_ID
    })
    console.log(
        `Token Swap State Account: ${tokenSwapStateAccount.publicKey}`
    )
   

    const [swapAuthority, bump] = await web3.PublicKey.findProgramAddressSync(
        [tokenSwapStateAccount.publicKey.toBuffer()],
        TOKEN_SWAP_PROGRAM_ID,
    )

    console.log(
        `Swap Authority: ${swapAuthority}`
    )

    
    let tokenAAccountAddress = await token.getAssociatedTokenAddress(
        tokenAMint, // mint
        swapAuthority, // owner
        true, // allow owner off curve,
        programId,
        token.ASSOCIATED_TOKEN_PROGRAM_ID
    )
    console.log(
        `Token A Account Address: ${tokenAAccountAddress}`
    )
    
    const tokenAAccountInstruction = await token.createAssociatedTokenAccountInstruction(
        user.publicKey, // payer
        tokenAAccountAddress, // ata
        swapAuthority, // owner
        tokenAMint, // mint
        programId,
        token.ASSOCIATED_TOKEN_PROGRAM_ID
    )

    let tokenBAccountAddress = await token.getAssociatedTokenAddress(
        tokenBMint, // mint
        swapAuthority, // owner
        true, // allow owner off curve
        programId,
        token.ASSOCIATED_TOKEN_PROGRAM_ID
    )
    console.log(
        `Token B Account Address: ${tokenBAccountAddress}`
    )
    
    const tokenBAccountInstruction = await token.createAssociatedTokenAccountInstruction(
        user.publicKey, // payer
        tokenBAccountAddress, // ata
        swapAuthority, // owner
        tokenBMint, // mint
        programId,
        token.ASSOCIATED_TOKEN_PROGRAM_ID
    )

    const poolTokenMint = await token.createMint(
        connection,
        user,
        swapAuthority,
        null,
        2
    )
    console.log(
        `Pool Mint: ${poolTokenMint}`
    )

    const tokenAccountPool = web3.Keypair.generate()
    console.log(
        `Token Account Pool: ${tokenAccountPool.publicKey}`
    )

    const rent2 = await token.getMinimumBalanceForRentExemptAccount(connection)
    const createTokenAccountPoolInstruction = web3.SystemProgram.createAccount({
        fromPubkey: user.publicKey,
        newAccountPubkey: tokenAccountPool.publicKey,
        space: token.ACCOUNT_SIZE,
        lamports: rent2,
        programId: programId,// new web3.PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")//
    })

    //await connection.requestAirdrop(tokenAccountPool.publicKey,1e9)

    const initializeTokenAccountPoolInstruction = token.createInitializeAccountInstruction(
        tokenAccountPool.publicKey,
        poolTokenMint,
        user.publicKey,
        programId
    )

    const feeOwner = new web3.PublicKey('HfoTxFR1Tm6kGmWgYWD6J7YHVy1UwqSULUGVLXkJqaKN')

    let tokenFeeAccountAddress = await token.getAssociatedTokenAddress(
        poolTokenMint, // mint
        feeOwner, // owner
        true, // allow owner off curve
        programId,
        token.ASSOCIATED_TOKEN_PROGRAM_ID
    )
    console.log(
        `Fee Account: ${tokenFeeAccountAddress}`
    )

    const tokenFeeAccountInstruction = await token.createAssociatedTokenAccountInstruction(
        user.publicKey, // payer
        tokenFeeAccountAddress, // ata
        feeOwner, // owner
        poolTokenMint, // mint
        programId,
        token.ASSOCIATED_TOKEN_PROGRAM_ID
    )

    const createSwapInstruction = TokenSwap.createInitSwapInstruction(
        tokenSwapStateAccount,      // Token swap state account
        swapAuthority,              // Swap pool authority
        tokenAAccountAddress,                 // Token A token account
        tokenBAccountAddress,                 // Token B token account
        poolTokenMint,              // Swap pool token mint
        tokenFeeAccountAddress,     // Token fee account
        tokenAccountPool.publicKey, // Swap pool token account
        programId,     // Token Program ID
        TOKEN_SWAP_PROGRAM_ID,      // Token Swap Program ID
        BigInt(0),                          // Trade fee numerator
        BigInt(10000),                      // Trade fee denominator
        BigInt(5),                          // Owner trade fee numerator
        BigInt(10000),                      // Owner trade fee denominator
        BigInt(0),                          // Owner withdraw fee numerator
        BigInt(0),                          // Owner withdraw fee denominator
        BigInt(20),                         // Host fee numerator
        BigInt(100),                        // Host fee denominator
        CurveType.ConstantProduct   // Curve type
    )
    transaction.add(tokenSwapStateAccountInstruction,tokenAAccountInstruction, tokenBAccountInstruction,createTokenAccountPoolInstruction, initializeTokenAccountPoolInstruction, tokenFeeAccountInstruction, createSwapInstruction)
    const signature = await web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [user, tokenSwapStateAccount, tokenAccountPool],
      );
    console.log('SIGNATURE', signature);
}

main()
    .then(() => {
        console.log("Finished successfully")
        process.exit(0)
    })
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })
