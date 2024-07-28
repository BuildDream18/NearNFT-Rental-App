"use client";

import "@near-wallet-selector/modal-ui/styles.css";
import { Inter } from "next/font/google";
import "../styles.css";
import "./globals.css";

import { MintbaseWalletContextProvider } from "@mintbase-js/react";
import { QueryClient, QueryClientProvider } from "react-query";
import Header from "@/components/header";
import { mbjs } from "@mintbase-js/sdk";
import { ApolloClient, ApolloProvider, InMemoryCache } from "@apollo/client";

const inter = Inter({ subsets: ["latin"] });

export const isDev = process.env.NEXT_PUBLIC_ENV === 'dev'

export const getCallbackUrl = () => {
  let callbackUrl = ''

  if (typeof window !== 'undefined') {
    callbackUrl =
      isDev && window.location?.host.includes('localhost')
        ? `http://${window.location.host}`
        : process.env.NEXT_PUBLIC_URL || '';
  }

  return callbackUrl
}


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = new QueryClient();

  mbjs.config({
    network: process.env.NEXT_PUBLIC_NETWORK || 'testnet'
  })

  const MintbaseWalletSetup = {
    contractAddress: "ricardostore.mintspace2.testnet",
    network: "testnet",
    callbackUrl: getCallbackUrl(),
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ApolloProvider client={mintbaseClient}>
      <MintbaseWalletContextProvider {...MintbaseWalletSetup}>
        <html lang="en">
          <body className={inter.className}>
            {/* <SocialMedias /> */}
            <Header />
            <div className="min-h-screen">{children}</div>
          </body>
        </html>
      </MintbaseWalletContextProvider>
      </ApolloProvider>
    </QueryClientProvider>
  );
}
const mintbaseClient = new ApolloClient({
  uri: "https://interop-testnet.hasura.app/v1/graphql",
  cache: new InMemoryCache(),
});