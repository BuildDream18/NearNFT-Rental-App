import React from "react";
import { NftInfo } from "../../NftInfo";
import { gql, useQuery } from "@apollo/client";
import { myBorrowings, myLendings } from "../../near-api";
import { useMbWallet } from "@mintbase-js/react";

const GET_TOKENS = gql`
    query GetTokens($rental_contract_id: String!, $account_id: String!) {
      under_lease: mb_views_nft_tokens(
        where: {owner: {_eq: $rental_contract_id}, burned_timestamp: {_is_null: true}}) {
        owner
        media
        title
        token_id
        description
        minter
        nft_contract_icon
        nft_contract_id
        nft_contract_name
      }
      user_owned: mb_views_nft_tokens(
        where: {owner: {_eq: $account_id}, burned_timestamp: {_is_null: true}}) {
        owner
        media
        title
        token_id
        description
        minter
        nft_contract_icon
        nft_contract_id
        nft_contract_name
      }
    }
  `;

export default function AcceptBorrowingPage({params, handleClick}) {
  const { activeAccountId } = useMbWallet();

  const { contractId, tokenId,  title } = params;
  const [accountId, setAccountId] = React.useState();
  const [rentalContractId, setRentalContractId] = React.useState();
  const [lendings, setLendings] = React.useState([]);
  const [borrowings, setBorrowings] = React.useState([]);

  React.useEffect(() => {
    const accountId = window.accountId || activeAccountId;
    setAccountId(accountId);
    setRentalContractId(window.rentalContract.contractId);

    async function fetch() {
      myLendings(accountId).then((lendings) =>
        setLendings(() => lendings)
      );
      myBorrowings(accountId).then((borrowings) =>
        setBorrowings(() => borrowings)
      );
    }
    fetch();
  }, []);

  console.log(lendings);
  console.log(borrowings);
  
  const { data } = useQuery(
    GET_TOKENS,
    {
      variables: {
        rental_contract_id: rentalContractId,
        account_id: accountId
      },
      skip: !accountId || !rentalContractId,
    }
  );
  const valid = data?.user_owned.find((nft) => nft.token_id === tokenId);
  
  return (
    <>
      <div className="py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 space-y-8">
          <h1 className="text-2xl mb-8 font-semibold text-gray-900">
            NFT Details
          </h1>
          <NftInfo contractId={contractId} tokenId={tokenId} />
          <div className="pt-5 space-x-4">
          { valid && <button
              onClick={() => handleClick({title: "lend", contractId: contractId, tokenId: tokenId})}
            >
              <div className="primary-btn inline-block">
                Lend
              </div>
            </button>
          }
            <button
              className={!valid ? "btn flex-1 sm:w-1/3 text-center" : "btn"}
              onClick={() => handleClick({ title: title === "nft" ? "My NFT" : "Shops" })}
            >
              Back
            </button>
          </div >
        </div >
      </div>
    </>
  );
}
