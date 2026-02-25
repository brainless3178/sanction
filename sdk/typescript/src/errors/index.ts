export enum SssErrorCode {
    Unauthorized = "Unauthorized",
    MasterAuthorityRequired = "MasterAuthorityRequired",
    AuthorityTransferNotReady = "AuthorityTransferNotReady",
    ComplianceNotEnabled = "ComplianceNotEnabled",
    PermanentDelegateNotEnabled = "PermanentDelegateNotEnabled",
    GlobalPause = "GlobalPause",
    QuotaExceeded = "QuotaExceeded",
    Overflow = "Overflow",
    NameTooLong = "NameTooLong",
    SymbolTooLong = "SymbolTooLong",
    InvalidDecimals = "InvalidDecimals",
    ZeroAmount = "ZeroAmount",
    AlreadyBlacklisted = "AlreadyBlacklisted",
    NotBlacklisted = "NotBlacklisted",
    SourceBlacklisted = "SourceBlacklisted",
    DestinationBlacklisted = "DestinationBlacklisted",
}

export const SSS_ERROR_MESSAGES: Record<SssErrorCode, string> = {
    [SssErrorCode.Unauthorized]: "Unauthorized: caller does not hold the required role",
    [SssErrorCode.MasterAuthorityRequired]: "Master authority required for this operation",
    [SssErrorCode.AuthorityTransferNotReady]: "Authority transfer not initiated or timelock not elapsed",
    [SssErrorCode.ComplianceNotEnabled]: "Compliance module not enabled. Reinitialize with enable_transfer_hook=true",
    [SssErrorCode.PermanentDelegateNotEnabled]: "Permanent delegate not enabled on this mint",
    [SssErrorCode.GlobalPause]: "Global pause is active. No operations permitted",
    [SssErrorCode.QuotaExceeded]: "Minter quota exceeded for this period",
    [SssErrorCode.Overflow]: "Arithmetic overflow in amount calculation",
    [SssErrorCode.NameTooLong]: "Name exceeds 32 character limit",
    [SssErrorCode.SymbolTooLong]: "Symbol exceeds 10 character limit",
    [SssErrorCode.InvalidDecimals]: "Decimals must be between 0 and 9",
    [SssErrorCode.ZeroAmount]: "Amount must be greater than zero",
    [SssErrorCode.AlreadyBlacklisted]: "Address is already blacklisted",
    [SssErrorCode.NotBlacklisted]: "Address is not on the blacklist",
    [SssErrorCode.SourceBlacklisted]: "Transfer blocked: source address is blacklisted",
    [SssErrorCode.DestinationBlacklisted]: "Transfer blocked: destination address is blacklisted",
};

export class SssSdkError extends Error {
    constructor(public code: SssErrorCode, message?: string) {
        super(message || SSS_ERROR_MESSAGES[code]);
        this.name = "SssSdkError";
    }
}
