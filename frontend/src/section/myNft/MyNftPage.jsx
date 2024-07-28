import React from "react";
import { useQuery, gql } from "@apollo/client";
import { myLendings, myBorrowings, claimBack } from "../../near-api";
import { MS_TO_NS_SCALE } from "../../Util";
import { durationString } from "../../Util";
import { useMbWallet } from "@mintbase-js/react";

// TODO(libo): use more efficient way to query tokens under lease.
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

export default function MyNftPage({handleClick}) {
  
  const { activeAccountId } = useMbWallet();

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

  const { loading, error, data } = useQuery(
    GET_TOKENS,
    {
      variables: {
        rental_contract_id: rentalContractId,
        account_id: accountId
      },
      skip: !accountId || !rentalContractId,
    },
  );
  if (error) {
    console.log(error);
    return <p>Error</p>;
  }
  if (loading) return "Loading";
  if (!data) return "No data";
  const nfts = [...data.user_owned];
  for (let l of lendings) {
    let [lease_id, i] = l;
    let nft = data.under_lease.find((x) => x.nft_contract_id == i.contract_addr && x.token_id == i.token_id);
    if (nft !== undefined) {
      nft = {
        ...nft,
        lease_id: lease_id,
        lender_id: i.lender_id,
        borrower_id: i.borrower_id,
        lease_start_ts_nano: i.start_ts_nano,
        lease_end_ts_nano: i.end_ts_nano
      };
      nfts.push(nft);
    }
  }
  for (let b of borrowings) {
    let [lease_id, i] = b;
    let nft = data.under_lease.find((x) => x.nft_contract_id == i.contract_addr && x.token_id == i.token_id);
    if (nft !== undefined) {
      nft = {
        ...nft,
        lease_id: lease_id,
        lender_id: i.lender_id,
        borrower_id: i.borrower_id,
        lease_start_ts_nano: i.start_ts_nano,
        lease_end_ts_nano: i.end_ts_nano
      };
      nfts.push(nft);
    }
  }

  const nfts_by_contract = {}
  for (let i of nfts) {
    let key = i.nft_contract_id;
    if (nfts_by_contract[key]) {
      nfts_by_contract[key].push(i);
    } else {
      nfts_by_contract[key] = [i];
    }
  }

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {Object.entries(nfts_by_contract).map(([k, v]) =>
          <div key={k}>
            <div className="grid gap-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {
                v.map(({ token_id, title, nft_contract_id, media, lender_id, borrower_id, lease_end_ts_nano, lease_id }) => {
                
                  return <div
                    key={nft_contract_id + "/" + token_id}
                    className="border p-4 border-black rounded-md space-y-4 w-72">
                    <p className="text-ellipsis overflow-clip">{title}</p>
                    <div className="h-96">
                      <img className="w-full h-full" src={media} />
                    </div>
                    {lender_id && lender_id != window.accountId || activeAccountId && <p className="text-ellipsis overflow-clip">Rented from: {lender_id}</p>}
                    {borrower_id && borrower_id != window.accountId || activeAccountId && <p className="text-ellipsis overflow-clip">Rented to: {borrower_id}</p>}
                    {lease_end_ts_nano && lease_end_ts_nano > Date.now() * MS_TO_NS_SCALE && <p className="text-ellipsis overflow-clip">
                      Lease ends: {durationString(lease_end_ts_nano - Date.now() * MS_TO_NS_SCALE)}
                    </p>}
                    {lease_end_ts_nano && lease_end_ts_nano <= Date.now() * MS_TO_NS_SCALE && <p className="text-ellipsis overflow-clip">
                      Lease ended: {durationString(Date.now() * MS_TO_NS_SCALE - lease_end_ts_nano)} ago
                    </p>}
                    <div className="flex flex-row justify-center space-x-2">
                      {!lender_id && !borrower_id &&
                        <button onClick={() => handleClick({title: "lend", contractId: nft_contract_id, tokenId: token_id})} className="primary-btn flex-1 w-32 text-center"> Lend </button>
                      }
                      {lease_end_ts_nano && lease_end_ts_nano < Date.now() * MS_TO_NS_SCALE &&
                        lender_id && lender_id == window.accountId || activeAccountId &&
                        <button onClick={() => claimBack(lease_id)} className="primary-btn flex-1 w-32 text-center"> Claim back </button>
                      }
                      <button onClick={() => handleClick({title: "details", contractId: nft_contract_id, tokenId: token_id})} 
                        className="btn flex-1 w-32 text-center"> Details </button>
                    </div>
                  </div>
                })
              }
            </div>
          </div>
        )}
      </div>
    </div >
  );
}
