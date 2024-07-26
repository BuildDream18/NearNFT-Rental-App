use crate::*;
/// approval callbacks from NFT Contracts

pub const MAX_LEN_PAYOUT: u32 = 50;
#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ListingJson {
    ft_contract_id: AccountId,
    price: U128,
    lease_start_ts_nano: U64,
    lease_end_ts_nano: U64,
}

/**
 * Trait to be used as the call back from NFT contract for listing creation.
 * When a lender trys to create a listing, she calls nft_approve attaching a msg of required info.
 * NFT contract will fire a XCC to this marketplace to invoke this function.
 * This will triger creating a listing.
*/
trait NonFungibleTokenApprovalsReceiver {
    fn nft_on_approve(
        &mut self,
        token_id: TokenId,
        owner_id: AccountId,
        approval_id: u64,
        msg: String,
    );
}

#[near_bindgen]
impl NonFungibleTokenApprovalsReceiver for Contract {
    /// Function to initiate new listing creation.
    fn nft_on_approve(
        &mut self,
        token_id: TokenId,
        owner_id: AccountId,
        approval_id: u64,
        msg: String,
    ) {
        // enforce cross contract call
        let nft_contract_id = env::predecessor_account_id();
        assert_ne!(
            env::current_account_id(),
            nft_contract_id,
            "nft_on_approve should only be called via XCC"
        );

        // enforce owner_id is the signer
        let signer_id = env::signer_account_id();
        assert_eq!(owner_id, signer_id, "owner_id should be signer_id");

        // enforce nft contract is allowed
        require!(
            self.allowed_nft_contract_ids.contains(&nft_contract_id),
            "nft_contract_id is not allowed!"
        );

        // enfore the token is not listed more than once
        require!(
            self.listing_by_id
                .get(&(nft_contract_id.clone(), token_id.clone()))
                .is_none(),
            "One nft token cannot be listed more than once!!"
        );

        // extract listing details
        let listing_json: ListingJson =
            near_sdk::serde_json::from_str(&msg).expect("Invalid Listing Json!");

        // enforce ft contract is allowed
        require!(
            self.allowed_ft_contract_ids
                .contains(&listing_json.ft_contract_id),
            "ft_contract_id is not allowed!"
        );

        // query the payouts field of the leasing token & create a listing accordingly
        ext_nft::ext(nft_contract_id.clone())
        .nft_payout(
            token_id.clone(), 
            U128::from(listing_json.price.0),  // price
            Some(MAX_LEN_PAYOUT),            // max_len_payout
        ).then(
            ext_self::ext(env::current_account_id())
            .with_static_gas(GAS_FOR_ROYALTIES)
            .create_listing_with_payout(
                owner_id, 
                approval_id, 
                nft_contract_id, 
                token_id, 
                listing_json.ft_contract_id, 
                listing_json.price, 
                listing_json.lease_start_ts_nano.0,
                listing_json.lease_end_ts_nano.0,
            ),
        ).as_return();
        
    }
}
