import React from "react";
import { useQuery, gql } from "@apollo/client";
import { getAllowedFTs, initContract, listingsByNftContractId } from "../../near-api";
import { fromNormalisedAmount, ftSymbol } from "../../FtContract"
import { dateTimeString, durationString } from "../../Util";

const GET_TOKENS = gql`
    query GetTokens($nft_contract_id: String!, $nft_token_ids: [String!]!) {
      mb_views_nft_tokens(
        where: {
          nft_contract_id: {_eq: $nft_contract_id},
          token_id: {_in: $nft_token_ids},
          burned_timestamp: {_is_null: true}},
        ) {
        owner
        media
        title
        token_id
      }
    }
  `;

export default function ShopPage({handleClick}) {
  const contractId  = "ricardostore.mintspace2.testnet";
  // const shopName = contractIdToName(contractId);
  // const shopDescription = contractIdToDescription(contractId);
  const [listings, setListings] = React.useState([]);

  React.useEffect(() => {
    async function fetchListings() {
      await initContract();

      if (typeof window !== 'undefined') {
        window.CURRENCY_OPTIONS = await getAllowedFTs();
      }

      listingsByNftContractId(contractId).then((listings) => {
          setListings(() => listings)
        }
      );
    }
    fetchListings();
  }, []);

  const { loading, error, data } = useQuery(
    GET_TOKENS,
    {
      variables: {
        nft_contract_id: contractId,
        nft_token_ids: listings.map((listing) => listing.nft_token_id)
      }
    }
  );

  if (error) {
    console.log(error);
    return <p>Error</p>;
  }
  if (loading) return "Loading";

  const nft_info_by_token_id = {};
  for (let i of data.mb_views_nft_tokens) {
    nft_info_by_token_id[i.token_id] = i;
  }

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      {listings.length == 0 && <div className="text-center">No NFTs available for rent at the moment</div>}
      <div className="grid gap-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {
          listings.map(({ nft_token_id, price, ft_contract_id,nft_contract_id, lease_start_ts_nano, lease_end_ts_nano }) => {
            let nft_info = nft_info_by_token_id[nft_token_id];
            return (
              <div key={contractId + "/" + nft_token_id} className="border p-4 border-black rounded-md space-y-4 w-72">
                <p>{nft_info.title}</p>
                <div className="h-96">
                  <img className="h-full w-full" src={nft_info.media} />
                </div>
                <p className="text-center">{fromNormalisedAmount(ft_contract_id, price)} {ftSymbol(ft_contract_id)} / ~{durationString(lease_end_ts_nano - lease_start_ts_nano)}</p>
                <p className="text-center text-sm">Start from {dateTimeString(lease_start_ts_nano)} </p>
                <div className="flex flex-row justify-center space-x-2">
                  <button className="primary-btn flex-1 w-32 text-center" onClick={() => handleClick({title: "rent", contractId:nft_contract_id, tokenId: nft_token_id}) }> Rent </button>
                  <button onClick={() => handleClick({title: "nfts", contractId: nft_contract_id, tokenId: nft_token_id})} className="btn flex-1 w-32 text-center"> Details </button>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}