use crate::*;

pub use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_contract_standards::non_fungible_token::events::NftTransfer;
use near_contract_standards::non_fungible_token::{metadata::TokenMetadata, Token};

use near_sdk::{assert_one_yocto, PromiseOrValue, PromiseResult};

const GAS_FOR_RESOLVE_TRANSFER: Gas = Gas(5_000_000_000_000);
const GAS_FOR_NFT_ON_TRANSFER: Gas = Gas(25_000_000_000_000 + GAS_FOR_RESOLVE_TRANSFER.0);
const DATA_IMAGE_SVG: &str = include_str!("data_image_svg.txt");

#[ext_contract(ext_nft_receiver)]
trait NonFungibleTokenReceiver {
    /// Method on the receiver contract that is called via XCC when nft_transfer_call is called
    /// Returns `true` if the token should be returned back to the sender.
    fn nft_on_transfer(
        &mut self,
        sender_id: AccountId,
        previous_owner_id: AccountId,
        token_id: TokenId,
        msg: String,
    ) -> Promise;
}

#[ext_contract(ext_self)]
trait NonFungibleTokenResolver {
    /// This method resolves the promise returned from the XCC to the receiver contract,
    /// as part of the nft_transfer_call method
    fn nft_resolve_transfer(
        &mut self,
        owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>, // logging trasnfer event - deault to None
        memo: Option<String>,                                  // memo for logging transfer event
    ) -> bool;
}

#[near_bindgen]
impl NonFungibleTokenCore for Contract {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        // TODO(libo): remove this suppressor after we implemented approval.
        #[allow(unused_variables)] approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        // Security assurance, on full access
        assert_one_yocto();
        let sender_id = env::predecessor_account_id();
        self.internal_transfer(&sender_id, &receiver_id, &token_id, memo);
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        // TODO(libo): remove this suppressor after we implemented approval.
        #[allow(unused_variables)] approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        assert_one_yocto();
        let sender_id = env::predecessor_account_id();
        let previous_token =
            self.internal_transfer(&sender_id, &receiver_id, &token_id, memo.clone());

        ext_nft_receiver::ext(receiver_id.clone())
            .with_static_gas(GAS_FOR_NFT_ON_TRANSFER)
            .nft_on_transfer(
                sender_id,
                previous_token.owner_id.clone(),
                token_id.clone(),
                msg,
            )
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_RESOLVE_TRANSFER)
                    .nft_resolve_transfer(
                        previous_token.owner_id,
                        receiver_id,
                        token_id,
                        None,
                        memo,
                    ),
            )
            .into()
    }

    /// Returns the token info with a given token_id. Info are assembled on the fly
    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        let active_lease_id_for_token = self.lease_token_id_to_lease_id(&token_id);

        if self.active_lease_ids.contains(&active_lease_id_for_token) {
            // Get the lease condition to assemble token info and token metadata
            let lease_condition = self.lease_map.get(&active_lease_id_for_token).unwrap();

            // Generate token metadata on the fly. Hard coded for now
            let token_metadata = TokenMetadata{
                title: Some(format!("RentApp Lease Ownership Token: {}", &active_lease_id_for_token)), 
                description: Some(
                    format!("
                    This is a token representing the ownership of the NFT under the RentApp lease: {lease_id}\n
                    Leasing NFT's contract: {contract_id}\n
                    Leasing NFT's token id: {leased_token_id}\n", 
                    lease_id=&active_lease_id_for_token,
                    contract_id=&lease_condition.contract_addr,
                    leased_token_id=&lease_condition.token_id,
                )),
                media: Some(DATA_IMAGE_SVG.to_string()),
                media_hash: None,
                copies: None,
                issued_at: None,
                expires_at: None,
                starts_at: None,
                updated_at: None,
                extra: None,
                reference: None,
                reference_hash: None,
            };

            // Return the token object with assembled info
            Some(Token {
                token_id,
                owner_id: lease_condition.lender_id,
                metadata: Some(token_metadata),
                approved_account_ids: None, // TODO(syu): Add support for Approval
            })
        } else {
            // If there wasn't any token_id in tokens_by_id, return None
            None
        }
    }
}

#[near_bindgen]
impl NonFungibleTokenResolver for Contract {
    /// Resolves XCC result from receiver's nft_on_transfer
    /// Returns true if the token was successfully transferred to the receiver_id
    fn nft_resolve_transfer(
        &mut self,
        previouse_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        // TODO: remove this suppressor after implementing approval.
        #[allow(unused_variables)] approved_account_ids: Option<HashMap<AccountId, u64>>, // logging trasnfer event - deault to None
        memo: Option<String>, // memo for logging transfer event
    ) -> bool {
        // Check whether the token should be returned to previous owner
        let should_revert = match env::promise_result(0) {
            PromiseResult::NotReady => env::abort(),
            PromiseResult::Successful(value) => {
                if let Ok(true_or_false) = near_sdk::serde_json::from_slice::<bool>(&value) {
                    true_or_false
                } else {
                    true
                }
            }
            PromiseResult::Failed => true,
        };

        // If the XCC indicated no revert, return early
        if !should_revert {
            return true;
        }

        // Otherwise, try to revert this transfer and return the token to the previous owner
        if let Some(lease_condition) = self.lease_map.get(&token_id) {
            // Check that the receiver didn't transfer the token away or burned it
            if lease_condition.lender_id != receiver_id {
                // The token is no longer owned by the receiver. Can't return it
                return true;
            }
        } else {
            // No token_id record. The token doesn't exist any more, or got burned
            return true;
        }

        self.internal_update_active_lease_lender(&receiver_id, &previouse_owner_id, &token_id);

        // Log transfer event as per the Events standard
        NftTransfer {
            old_owner_id: &receiver_id,
            new_owner_id: &previouse_owner_id,
            token_ids: &[&token_id],
            authorized_id: None,
            memo: memo.as_deref(),
        }
        .emit();

        return false;
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    /*
    Unit test cases and helper functions
    Test naming format for better readability:
    - test_{function_name} _{succeeds_or_fails} _{condition}
    - When more than one test cases are needed for one function,
    follow the code order of testing failing conditions first and success condition last
    */

    use crate::tests::*;
    use crate::{Contract, LeaseState};

    use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
    use near_contract_standards::non_fungible_token::TokenId;

    use near_sdk::test_utils::{self, accounts, VMContextBuilder};
    use near_sdk::testing_env;

    #[test]
    fn test_nft_token_succeeds_non_existing_token_id() {
        let mut contract = Contract::new(accounts(1).into());
        let mut lease_condition = create_lease_condition_default();
        lease_condition.state = LeaseState::Active;

        let key = "test_key".to_string();
        contract.lease_map.insert(&key, &lease_condition);
        contract.active_lease_ids.insert(&key);

        let non_existing_token_id: TokenId = "dummy_token_id".to_string();
        let a_token = contract.nft_token(non_existing_token_id.clone());

        assert!(a_token.is_none())
    }

    #[test]
    fn test_nft_token_succeeds_existing_token_id() {
        let mut contract = Contract::new(accounts(1).into());
        let mut lease_condition = create_lease_condition_default();
        lease_condition.state = LeaseState::Active;

        let lease_id = "test_lease_id".to_string();
        contract.lease_map.insert(&lease_id, &lease_condition);
        contract.active_lease_ids.insert(&lease_id);

        let lease_nft_token_id = contract.lease_id_to_lease_token_id(&lease_id);
        let a_token = contract.nft_token(lease_nft_token_id.clone());

        assert!(a_token.is_some());
        assert_eq!(lease_nft_token_id, a_token.as_ref().unwrap().token_id);
        assert_eq!(
            lease_condition.lender_id.clone(),
            a_token.as_ref().unwrap().owner_id
        );
        assert!(a_token.as_ref().unwrap().metadata.is_some());
        assert!(a_token
            .as_ref()
            .unwrap()
            .metadata
            .as_ref()
            .unwrap()
            .title
            .is_some());
        assert!(a_token
            .as_ref()
            .unwrap()
            .metadata
            .as_ref()
            .unwrap()
            .description
            .is_some());
    }

    #[test]
    fn test_event_transfer_log_for_nft_transfer_succeeds() {
        let mut contract = Contract::new(accounts(0).into());
        let mut lease_condition = create_lease_condition_default();
        lease_condition.lender_id = create_a_dummy_account_id("alice");

        let lease_key = "test_key".to_string();
        contract.internal_insert_lease(&lease_key, &lease_condition);
        lease_condition.state = LeaseState::Active;

        contract.nft_mint(lease_key.clone(), lease_condition.lender_id.clone());
        testing_env!(VMContextBuilder::new()
            .current_account_id(accounts(0))
            .predecessor_account_id(lease_condition.lender_id.clone())
            .attached_deposit(1)
            .build());

        // transfer the nft
        let token_id = contract.lease_id_to_lease_token_id(&lease_key);
        contract.nft_transfer(
            create_a_dummy_account_id("bob"),
            token_id.clone(),
            None,
            None,
        );

        // Check transfer logs
        let transfer_log = &test_utils::get_logs()[0]; // the index can be different when other logs added
        let transfer_log_expected = r#"EVENT_JSON:{"standard":"nep171","version":"1.0.0","event":"nft_transfer","data":[{"old_owner_id":"alice","new_owner_id":"bob","token_ids":["test_key_lender"]}]}"#;
        assert_eq!(transfer_log, transfer_log_expected);
    }
}
