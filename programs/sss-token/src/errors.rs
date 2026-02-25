use anchor_lang::prelude::*;

#[error_code]
pub enum SssError {
    // Authority errors
    #[msg("Unauthorized: caller does not hold the required role")]
    Unauthorized,
    #[msg("Master authority required for this operation")]
    MasterAuthorityRequired,
    #[msg("Authority transfer not initiated or timelock not elapsed")]
    AuthorityTransferNotReady,
    
    // Feature flag errors  
    #[msg("Compliance module not enabled. Reinitialize with enable_transfer_hook=true")]
    ComplianceNotEnabled,
    #[msg("Permanent delegate not enabled on this mint")]
    PermanentDelegateNotEnabled,
    
    // State errors
    #[msg("Global pause is active. No operations permitted")]
    GlobalPause,
    #[msg("Minter quota exceeded for this period")]
    QuotaExceeded,
    #[msg("Arithmetic overflow in amount calculation")]
    Overflow,
    
    // Validation errors
    #[msg("Name exceeds 32 character limit")]
    NameTooLong,
    #[msg("Symbol exceeds 10 character limit")]
    SymbolTooLong,
    #[msg("Decimals must be between 0 and 9")]
    InvalidDecimals,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    
    // Blacklist errors
    #[msg("Address is already blacklisted")]
    AlreadyBlacklisted,
    #[msg("Address is not on the blacklist")]
    NotBlacklisted,
    
    // Transfer hook errors
    #[msg("Transfer blocked: source address is blacklisted")]
    SourceBlacklisted,
    #[msg("Transfer blocked: destination address is blacklisted")]
    DestinationBlacklisted,
}
